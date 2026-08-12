// Oura token handling.
//
// Worth testing more carefully than the rest of this integration, because the
// failure mode is unrecoverable without a human. Oura invalidates a refresh
// token as it's spent, so the successor returned alongside the access token is
// the only way back in — spend one and fail to store it and the next sync has
// nothing to present. Every assertion below is some version of "the successor
// survived".

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOuraAccessToken, ouraCollection } from "./oura.js";

const blobs = new Map();
const store = {
	get: vi.fn(async (key) => blobs.get(key) ?? null),
	setJSON: vi.fn(async (key, value) => {
		blobs.set(key, value);
	}),
};

const stored = () => blobs.get("oura.json") || null;

// A token response, with a successor that's deliberately never the token that
// was spent to get it.
function tokenReply({ access = "access-1", refresh = "refresh-2", expiresIn = 86400 } = {}) {
	return new Response(
		JSON.stringify({ access_token: access, refresh_token: refresh, expires_in: expiresIn }),
		{ status: 200 },
	);
}

beforeEach(() => {
	blobs.clear();
	store.get.mockClear();
	store.setJSON.mockClear();
	process.env.OURA_CLIENT_ID = "id";
	process.env.OURA_CLIENT_SECRET = "secret";
	process.env.OURA_REFRESH_TOKEN = "bootstrap";
});

describe("getOuraAccessToken", () => {
	it("reports missing credentials as configuration rather than failure", async () => {
		// The caller tells these apart: an unconfigured ring is the normal
		// state of a fresh checkout and mustn't look like a broken sync.
		delete process.env.OURA_CLIENT_ID;
		await expect(getOuraAccessToken(store)).rejects.toMatchObject({ code: "not_configured" });

		process.env.OURA_CLIENT_ID = "id";
		delete process.env.OURA_REFRESH_TOKEN;
		await expect(getOuraAccessToken(store)).rejects.toMatchObject({ code: "not_configured" });
	});

	it("bootstraps from the environment when nothing is stored yet", async () => {
		globalThis.fetch = vi.fn(async () => tokenReply());

		expect(await getOuraAccessToken(store)).toBe("access-1");

		const body = globalThis.fetch.mock.calls[0][1].body;
		expect(body.get("grant_type")).toBe("refresh_token");
		expect(body.get("refresh_token")).toBe("bootstrap");
	});

	it("stores the successor, not the token it just spent", async () => {
		// The single most important line in this file. Oura has already
		// invalidated "bootstrap" by the time this resolves.
		globalThis.fetch = vi.fn(async () => tokenReply({ refresh: "refresh-2" }));

		await getOuraAccessToken(store);

		expect(stored().refreshToken).toBe("refresh-2");
		expect(stored().accessToken).toBe("access-1");
		expect(stored().expiresAt).toBeGreaterThan(Date.now());
	});

	it("writes the successor before handing out the access token", async () => {
		// Ordering, not just eventual state: returning first and writing
		// after would lose the successor to any failure in between, and the
		// access token would still have been spent.
		let writtenBeforeReturn = false;
		globalThis.fetch = vi.fn(async () => tokenReply());
		store.setJSON.mockImplementationOnce(async (key, value) => {
			writtenBeforeReturn = true;
			blobs.set(key, value);
		});

		await getOuraAccessToken(store);
		expect(writtenBeforeReturn).toBe(true);
	});

	it("reuses a stored access token rather than spending a refresh", async () => {
		blobs.set("oura.json", {
			accessToken: "still-good",
			refreshToken: "refresh-9",
			expiresAt: Date.now() + 3_600_000,
		});
		globalThis.fetch = vi.fn(async () => tokenReply());

		expect(await getOuraAccessToken(store)).toBe("still-good");
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("refreshes an access token that's about to expire", async () => {
		// Not on expiry: a token with thirty seconds left would be spent
		// mid-sync. The margin is what stops that being a race.
		blobs.set("oura.json", {
			accessToken: "nearly-done",
			refreshToken: "refresh-9",
			expiresAt: Date.now() + 60_000,
		});
		globalThis.fetch = vi.fn(async () => tokenReply({ access: "access-fresh" }));

		expect(await getOuraAccessToken(store)).toBe("access-fresh");
	});

	it("prefers the stored refresh token over the bootstrap", async () => {
		blobs.set("oura.json", { refreshToken: "refresh-9", expiresAt: 0 });
		globalThis.fetch = vi.fn(async () => tokenReply());

		await getOuraAccessToken(store);
		expect(globalThis.fetch.mock.calls[0][1].body.get("refresh_token")).toBe("refresh-9");
	});

	it("falls back to the bootstrap when the stored chain is broken", async () => {
		// The recovery path, and the reason OURA_REFRESH_TOKEN stays set
		// after the first sync: re-run the script, paste the new value into
		// Netlify, and the next sync heals itself without a deploy.
		blobs.set("oura.json", { refreshToken: "stale", expiresAt: 0 });
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response("nope", { status: 400 }))
			.mockResolvedValueOnce(tokenReply({ access: "recovered" }));

		expect(await getOuraAccessToken(store)).toBe("recovered");
		expect(globalThis.fetch.mock.calls[1][1].body.get("refresh_token")).toBe("bootstrap");
		expect(stored().refreshToken).toBe("refresh-2");
	});

	it("doesn't retry with a bootstrap that's the same token", async () => {
		// It was just refused. Asking twice only spends another request to
		// be told the same thing.
		blobs.set("oura.json", { refreshToken: "bootstrap", expiresAt: 0 });
		globalThis.fetch = vi.fn(async () => new Response("nope", { status: 400 }));

		await expect(getOuraAccessToken(store)).rejects.toThrow(/400/);
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it("refuses a response with no successor in it", async () => {
		// An access token without its refresh token is a dead end one sync
		// later, so it's treated as a failed refresh rather than stored.
		globalThis.fetch = vi.fn(
			async () => new Response(JSON.stringify({ access_token: "orphan" }), { status: 200 }),
		);

		await expect(getOuraAccessToken(store)).rejects.toThrow(/no token/);
		expect(stored()).toBeNull();
	});
});

describe("ouraCollection", () => {
	it("follows the pages and returns every document", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [{ day: "2026-08-10" }], next_token: "n1" })),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [{ day: "2026-08-11" }], next_token: null })),
			);

		const out = await ouraCollection("/v2/usercollection/sleep", "tok", {
			start: "2026-08-01",
			end: "2026-08-11",
		});

		expect(out.map((d) => d.day)).toEqual(["2026-08-10", "2026-08-11"]);
		expect(new URL(globalThis.fetch.mock.calls[0][0]).searchParams.get("start_date")).toBe("2026-08-01");
		expect(new URL(globalThis.fetch.mock.calls[1][0]).searchParams.get("next_token")).toBe("n1");
	});

	it("gives up rather than paging for ever", async () => {
		// A cursor that never terminates would otherwise spin a scheduled
		// function until the platform kills it.
		globalThis.fetch = vi.fn(
			async () => new Response(JSON.stringify({ data: [{ day: "2026-08-10" }], next_token: "loop" })),
		);

		await ouraCollection("/v2/usercollection/sleep", "tok", { start: "a", end: "b" });
		expect(globalThis.fetch.mock.calls.length).toBeLessThanOrEqual(10);
	});

	it("carries the status through on a refusal", async () => {
		// 403 is the membership having lapsed rather than anything here
		// being wrong, and the sync logs them differently.
		globalThis.fetch = vi.fn(async () => new Response("no", { status: 403 }));

		await expect(
			ouraCollection("/v2/usercollection/sleep", "tok", { start: "a", end: "b" }),
		).rejects.toMatchObject({ status: 403 });
	});
});
