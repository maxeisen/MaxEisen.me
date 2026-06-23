import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchJson, FetchError, isFetchErrorStatus } from "./fetchJson.js";

const realFetch = global.fetch;
afterEach(() => {
	global.fetch = realFetch;
	vi.restoreAllMocks();
});

describe("fetchJson", () => {
	it("returns the parsed body on a 2xx response", async () => {
		global.fetch = vi.fn(async () => new Response(JSON.stringify({ hello: "world" }), { status: 200 }));
		await expect(fetchJson("/x")).resolves.toEqual({ hello: "world" });
	});

	it("passes options straight through to fetch", async () => {
		global.fetch = vi.fn(async () => new Response("{}", { status: 200 }));
		await fetchJson("/y", { headers: { "X-Test": "1" } });
		expect(global.fetch).toHaveBeenCalledWith("/y", { headers: { "X-Test": "1" } });
	});

	it("throws a FetchError carrying the status on 503 (widget-hide signal)", async () => {
		global.fetch = vi.fn(async () => new Response("nope", { status: 503 }));
		const err = await fetchJson("/x").catch((e) => e);
		expect(err).toBeInstanceOf(FetchError);
		expect(err.status).toBe(503);
	});

	it("throws a FetchError carrying the status on 401 (re-prompt signal)", async () => {
		global.fetch = vi.fn(async () => new Response("no", { status: 401 }));
		const err = await fetchJson("/x").catch((e) => e);
		expect(err).toBeInstanceOf(FetchError);
		expect(err.status).toBe(401);
	});

	it("propagates a JSON-parse failure as a non-FetchError", async () => {
		global.fetch = vi.fn(async () => new Response("<html>not json", { status: 200 }));
		const err = await fetchJson("/x").catch((e) => e);
		expect(err).toBeInstanceOf(Error);
		expect(err).not.toBeInstanceOf(FetchError);
	});

	it("propagates an AbortError from an aborted signal", async () => {
		global.fetch = vi.fn(async (_url, opts) => {
			if (opts?.signal?.aborted) {
				const e = new Error("Aborted");
				e.name = "AbortError";
				throw e;
			}
			return new Response("{}", { status: 200 });
		});
		const ac = new AbortController();
		ac.abort();
		const err = await fetchJson("/x", { signal: ac.signal }).catch((e) => e);
		expect(err.name).toBe("AbortError");
		expect(err).not.toBeInstanceOf(FetchError);
	});
});

describe("isFetchErrorStatus", () => {
	it("matches the status for FetchError instances", () => {
		const err = new FetchError(503, "Service Unavailable", "/x");
		expect(isFetchErrorStatus(err, 503)).toBe(true);
		expect(isFetchErrorStatus(err, 401)).toBe(false);
	});

	it("returns false for non-FetchError values", () => {
		expect(isFetchErrorStatus(new Error("boom"), 503)).toBe(false);
		expect(isFetchErrorStatus({ status: 503 }, 503)).toBe(false);
		expect(isFetchErrorStatus(null, 503)).toBe(false);
	});
});
