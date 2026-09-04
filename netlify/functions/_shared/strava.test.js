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
