import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchJsonSwr, swrPeek, swrClear } from "./swrCache.js";
import { FetchError } from "./fetchJson.js";

const realFetch = global.fetch;

// A fetch mock that returns an incrementing counter so we can tell a cached
// response apart from a revalidated one.
function countingFetch() {
	let n = 0;
	return vi.fn(async () => {
		n += 1;
		return new Response(JSON.stringify({ n }), { status: 200 });
	});
}

// Let queued microtasks (background revalidation + onRevalidate) drain.
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
	swrClear();
});
afterEach(() => {
	global.fetch = realFetch;
	vi.restoreAllMocks();
});

describe("fetchJsonSwr", () => {
	it("fetches and caches on a miss", async () => {
		global.fetch = countingFetch();
		await expect(fetchJsonSwr("/a")).resolves.toEqual({ n: 1 });
		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(swrPeek("/a").value).toEqual({ n: 1 });
	});

	it("serves a fresh hit from cache without hitting the network", async () => {
		global.fetch = countingFetch();
		await fetchJsonSwr("/a", { maxAgeMs: 10_000 });
		const second = await fetchJsonSwr("/a", { maxAgeMs: 10_000 });
		expect(second).toEqual({ n: 1 });
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it("returns stale immediately and revalidates in the background", async () => {
		global.fetch = countingFetch();
		await fetchJsonSwr("/a", { maxAgeMs: 0 }); // n:1, immediately stale
		const onRevalidate = vi.fn();
		// Stale → returns the cached n:1 right away…
		const value = await fetchJsonSwr("/a", { maxAgeMs: 0, onRevalidate });
		expect(value).toEqual({ n: 1 });
		// …and refreshes to n:2 in the background.
		await flush();
		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(onRevalidate).toHaveBeenCalledWith({ n: 2 });
		expect(swrPeek("/a").value).toEqual({ n: 2 });
	});

	it("dedupes concurrent misses into a single request", async () => {
		global.fetch = countingFetch();
		const [a, b] = await Promise.all([fetchJsonSwr("/a"), fetchJsonSwr("/a")]);
		expect(a).toEqual({ n: 1 });
		expect(b).toEqual({ n: 1 });
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it("propagates errors on a miss (so callers can branch on status)", async () => {
		global.fetch = vi.fn(async () => new Response("no", { status: 503 }));
		const err = await fetchJsonSwr("/a").catch((e) => e);
		expect(err).toBeInstanceOf(FetchError);
		expect(err.status).toBe(503);
		expect(swrPeek("/a")).toBeUndefined(); // failed fetch is not cached
	});

	it("keeps the stale value when a background revalidation fails", async () => {
		let calls = 0;
		global.fetch = vi.fn(async () => {
			calls += 1;
			if (calls === 1) return new Response(JSON.stringify({ ok: true }), { status: 200 });
			return new Response("boom", { status: 500 });
		});
		await fetchJsonSwr("/a", { maxAgeMs: 0 });
		const onRevalidate = vi.fn();
		const value = await fetchJsonSwr("/a", { maxAgeMs: 0, onRevalidate });
		expect(value).toEqual({ ok: true }); // stale survives
		await flush();
		expect(onRevalidate).not.toHaveBeenCalled(); // background error swallowed
		expect(swrPeek("/a").value).toEqual({ ok: true });
	});

	it("swrClear empties the cache", async () => {
		global.fetch = countingFetch();
		await fetchJsonSwr("/a");
		swrClear();
		expect(swrPeek("/a")).toBeUndefined();
		await fetchJsonSwr("/a");
		expect(global.fetch).toHaveBeenCalledTimes(2); // refetched after clear
	});
});
