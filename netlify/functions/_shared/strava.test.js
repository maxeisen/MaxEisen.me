import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callsRemaining, cooldownUntil, readQuota } from "./strava.js";

function headers(map) {
	return new Headers(map);
}

describe("readQuota", () => {
	it("reads the short and daily buckets off a response", () => {
		expect(
			readQuota(headers({ "x-ratelimit-limit": "200,2000", "x-ratelimit-usage": "12,345" })),
		).toEqual({ shortUsage: 12, shortLimit: 200, dailyUsage: 345, dailyLimit: 2000 });
	});

	// Strava reports an overall bucket and a read-only one. The read bucket is
	// usually the tighter of the two for this app, and it's the one that will
	// start refusing first, so it has to win.
	it("reports whichever bucket is closest to its limit", () => {
		const quota = readQuota(
			headers({
				"x-ratelimit-limit": "200,2000",
				"x-ratelimit-usage": "20,100",
				"x-readratelimit-limit": "100,1000",
				"x-readratelimit-usage": "80,100",
			}),
		);
		expect(quota.shortUsage).toBe(80);
		expect(quota.shortLimit).toBe(100);
	});

	it("is null when the headers are missing or malformed", () => {
		expect(readQuota(headers({}))).toBeNull();
		expect(readQuota(headers({ "x-ratelimit-limit": "200", "x-ratelimit-usage": "12" }))).toBeNull();
		expect(readQuota(undefined)).toBeNull();
	});
});

describe("callsRemaining", () => {
	// Nothing observed yet is not the same as nothing left — the caller's own
	// budget has to stay in charge, or a first request would never be made.
	it("is unbounded before any quota has been seen", () => {
		expect(callsRemaining(null)).toBe(Infinity);
	});

	it("leaves the rest of the window for everything else on the same app", () => {
		const quota = { shortUsage: 40, shortLimit: 200, dailyUsage: 0, dailyLimit: 2000 };
		expect(callsRemaining(quota, { shortShare: 0.5 })).toBe(60);
	});

	it("is bounded by whichever window is tighter", () => {
		const quota = { shortUsage: 0, shortLimit: 200, dailyUsage: 1990, dailyLimit: 2000 };
		expect(callsRemaining(quota)).toBe(10);
	});

	it("never goes negative once a share is already overspent", () => {
		const quota = { shortUsage: 180, shortLimit: 200, dailyUsage: 0, dailyLimit: 2000 };
		expect(callsRemaining(quota, { shortShare: 0.5 })).toBe(0);
	});
});

// Strava's 15-minute windows land on the clock (:00/:15/:30/:45) and the daily
// window on midnight UTC. A 429 has to wait for the window that actually
// tripped, not a guessed 15 minutes from now — retries before that reset are
// what turn a short overage into a blown daily quota.
describe("cooldownUntil", () => {
	const now = Date.parse("2020-10-10T20:11:05Z");

	it("waits until midnight UTC when the daily bucket is spent", () => {
		expect(
			cooldownUntil(
				{ shortUsage: 10, shortLimit: 100, dailyUsage: 1000, dailyLimit: 1000 },
				{ now },
			),
		).toBe(Date.parse("2020-10-11T00:00:00Z"));
	});

	it("waits until the next quarter hour when only the short window is spent", () => {
		expect(
			cooldownUntil(
				{ shortUsage: 100, shortLimit: 100, dailyUsage: 200, dailyLimit: 1000 },
				{ now },
			),
		).toBe(Date.parse("2020-10-10T20:15:00Z"));
	});

	it("defaults to the next quarter hour when a 429 carried no quota headers", () => {
		expect(cooldownUntil(null, { now })).toBe(Date.parse("2020-10-10T20:15:00Z"));
	});

	it("honors Retry-After when it is later than the computed window", () => {
		expect(
			cooldownUntil(
				{ shortUsage: 100, shortLimit: 100, dailyUsage: 200, dailyLimit: 1000 },
				{ now, retryAfterSec: 20 * 60 },
			),
		).toBe(now + 20 * 60 * 1000);
	});
});

describe("getAccessToken", () => {
	const realFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = realFetch;
		delete process.env.STRAVA_CLIENT_ID;
		delete process.env.STRAVA_CLIENT_SECRET;
		delete process.env.STRAVA_REFRESH_TOKEN;
	});

	it("does not put the token endpoint body on a thrown error", async () => {
		vi.resetModules();
		process.env.STRAVA_CLIENT_ID = "id";
		process.env.STRAVA_CLIENT_SECRET = "super-secret";
		process.env.STRAVA_REFRESH_TOKEN = "refresh";
		globalThis.fetch = vi.fn(
			async () =>
				new Response(JSON.stringify({ error: "invalid", client_secret: "super-secret" }), {
					status: 400,
				}),
		);
		const { getAccessToken } = await import("./strava.js");
		const err = await getAccessToken().catch((e) => e);
		expect(err.message).toBe("Strava token refresh failed: 400");
		expect(err.message).not.toContain("super-secret");
		expect(err.message).not.toContain("invalid");
	});
});

describe("the in-memory 429 cache", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.useFakeTimers();
		vi.setSystemTime(Date.parse("2020-10-10T20:11:05Z"));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("blocks further calls until the window the 429 headers describe", async () => {
		const { noteRateLimit, isCoolingDown, rateLimitCacheHeaders } = await import("./strava.js");
		noteRateLimit(
			headers({
				"x-ratelimit-limit": "100,1000",
				"x-ratelimit-usage": "1000,1000",
			}),
		);
		expect(isCoolingDown()).toBe(true);
		expect(rateLimitCacheHeaders()).toEqual({
			"Cache-Control": "public, max-age=13735",
			"Retry-After": "13735",
		});

		vi.setSystemTime(Date.parse("2020-10-11T00:00:00Z"));
		expect(isCoolingDown()).toBe(false);
	});
});

describe("the Strava client", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	// A fake transport: each call gets the next reply, and every reply carries
	// the quota headers given, as Strava's do.
	function transport(replies, quota = null) {
		const calls = [];
		const send = vi.fn(async (url, init) => {
			calls.push({ url, init });
			const [status, body, usage = quota?.usage] = replies.shift() ?? [200, {}];
			const head = quota ? { "x-ratelimit-limit": quota.limit, "x-ratelimit-usage": usage } : {};
			return new Response(JSON.stringify(body), { status, headers: head });
		});
		return { send, calls };
	}

	it("spends freely until a response says where the quota is", async () => {
		const { createStravaClient } = await import("./strava.js");
		const { send, calls } = transport([[200, { id: 1 }]]);
		const strava = createStravaClient({ token: "tok", share: { shortShare: 0.5 }, fetch: send });

		expect(strava.canSpend(1000)).toBe(true);
		await expect(strava.get("/athlete")).resolves.toEqual({ id: 1 });
		expect(calls[0].url).toBe("https://www.strava.com/api/v3/athlete");
		expect(calls[0].init.headers.Authorization).toBe("Bearer tok");
	});

	// The widgets share this app's limit (60 of 100 here), so a job stops at its share and
	// leaves the rest. Nothing is sent once the share is gone.
	it("refuses to send once its share is spent, without asking Strava", async () => {
		const { createStravaClient } = await import("./strava.js");
		const { send } = transport([[200, {}], [200, {}, "60,101"]], { limit: "100,1000", usage: "59,100" });
		const strava = createStravaClient({ token: "t", share: { shortShare: 0.6 }, fetch: send });

		await strava.get("/first");
		expect(strava.canSpend(1)).toBe(true);
		expect(strava.canSpend(2)).toBe(false);
		expect(() => strava.reserve(2)).toThrow(expect.objectContaining({ status: 429, overShare: true }));

		await strava.get("/second");
		const err = await strava.get("/third").catch((e) => e);
		expect(err).toMatchObject({ status: 429, overShare: true });
		expect(send).toHaveBeenCalledTimes(2);
	});

	it("keeps quota per client, so one tick's reading never limits the next", async () => {
		const { createStravaClient } = await import("./strava.js");
		const spent = transport([[200, {}]], { limit: "100,1000", usage: "100,1000" });
		const first = createStravaClient({ token: "t", fetch: spent.send });
		await first.get("/x");
		expect(first.canSpend()).toBe(false);

		const second = createStravaClient({ token: "t", fetch: transport([]).send });
		expect(second.canSpend()).toBe(true);
	});

	it("stands every client down after a 429 until the window it describes", async () => {
		const { createStravaClient } = await import("./strava.js");
		const { send } = transport([[429, { message: "slow down" }]], { limit: "100,1000", usage: "100,500" });
		const strava = createStravaClient({ token: "t", fetch: send });

		const err = await strava.get("/x").catch((e) => e);
		expect(err).toMatchObject({ status: 429 });
		expect(err.overShare).toBeUndefined();
		expect(strava.coolingDown()).toBe(true);
		expect(Date.parse(strava.cooldownUntil())).toBeGreaterThan(Date.now());

		const other = createStravaClient({ token: "t", fetch: send });
		const refused = await other.get("/y").catch((e) => e);
		expect(refused).toMatchObject({ status: 429, overShare: false });
		expect(send).toHaveBeenCalledTimes(1);
	});

	it("sends a write as JSON and puts the reply on a failed one", async () => {
		const { createStravaClient } = await import("./strava.js");
		const { send, calls } = transport([[400, { message: "bad url" }]]);
		const strava = createStravaClient({ token: "t", fetch: send });

		const err = await strava.put("/activities/1", { description: "hi" }).catch((e) => e);
		expect(calls[0].init).toMatchObject({
			method: "PUT",
			body: JSON.stringify({ description: "hi" }),
			headers: { "Content-Type": "application/json" },
		});
		expect(err).toMatchObject({ status: 400, body: JSON.stringify({ message: "bad url" }) });
	});

	it("has no cooldown to persist when nothing was refused", async () => {
		const { createStravaClient } = await import("./strava.js");
		expect(createStravaClient({ token: "t", fetch: transport([]).send }).cooldownUntil()).toBeNull();
	});
});
