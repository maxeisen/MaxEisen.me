import { describe, it, expect } from "vitest";
import { callsRemaining, readQuota } from "./strava.js";

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
