// Homepage intro modals: YTD totals plus the bike/shoes on the most recent
// ride and run. Served from the snapshot trainingSync writes; this function
// never calls Strava.

import { describe, it, expect, vi, beforeEach } from "vitest";

const blobs = new Map();
const store = {
	get: vi.fn(async (key) => blobs.get(key) ?? null),
	setJSON: vi.fn(async (key, value) => {
		blobs.set(key, value);
	}),
};
vi.mock("@netlify/blobs", () => ({ getStore: () => store }));

const TARMAC = { id: "b-tarmac", name: "Specialized Tarmac SL7", distance: 9_000_000 };
const SUPERBLAST = { id: "g-superblast", name: "ASICS Superblast 3", distance: 400_000 };
const SNAPSHOT = {
	activities: [],
	bike: TARMAC,
	shoes: SUPERBLAST,
	ytd: {
		run: { count: 10, distance: 100_000, movingTime: 30_000, elevationGain: 200 },
		ride: { count: 8, distance: 200_000, movingTime: 20_000, elevationGain: 400 },
	},
};

async function payload() {
	const { default: handler } = await import("../stravaProfile.js");
	const res = await handler();
	return { res, body: await res.json() };
}

beforeEach(() => {
	vi.resetModules();
	blobs.clear();
	globalThis.fetch = vi.fn(async (url) => {
		throw new Error(`stravaProfile must not call Strava: ${url}`);
	});
});

describe("stravaProfile", () => {
	it("returns the bike and shoes from the most recent ride and run", async () => {
		blobs.set("public.json", SNAPSHOT);
		const { res, body } = await payload();

		expect(res.status).toBe(200);
		expect(body.bike).toEqual(TARMAC);
		expect(body.shoes).toEqual(SUPERBLAST);
		expect(body.ytd.run.count).toBe(10);
		expect(body.ytd.ride.count).toBe(8);
		expect(res.headers.get("cache-control")).toMatch(/max-age=300/);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("omits gear when nothing recent has it attached", async () => {
		blobs.set("public.json", {
			...SNAPSHOT,
			bike: null,
			shoes: null,
		});
		const { body } = await payload();
		expect(body.bike).toBeNull();
		expect(body.shoes).toBeNull();
		expect(body.ytd.run.count).toBe(10);
	});

	it("returns empty profile fields before the first sync rather than live-fetching", async () => {
		const { res, body } = await payload();
		expect(res.status).toBe(200);
		expect(body.bike).toBeNull();
		expect(body.shoes).toBeNull();
		expect(body.ytd).toEqual({ run: null, ride: null });
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
