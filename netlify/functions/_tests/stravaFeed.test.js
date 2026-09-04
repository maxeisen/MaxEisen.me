import { describe, it, expect, vi, beforeEach } from "vitest";

const blobs = new Map();
const store = {
	get: vi.fn(async (key) => blobs.get(key) ?? null),
	setJSON: vi.fn(async (key, value) => {
		blobs.set(key, value);
	}),
};
vi.mock("@netlify/blobs", () => ({ getStore: () => store }));

const SAMPLE = {
	id: 42,
	name: "Morning run",
	type: "Run",
	distance: 10000,
	movingTime: 3000,
	elapsedTime: 3100,
	elevationGain: 40,
	startDate: "2026-07-01T11:00:00Z",
	polyline: "_p~iF~ps|U_ulLnnqC",
	sufferScore: 61,
};

async function payload(query = "") {
	const { default: handler } = await import("../stravaFeed.js");
	const res = await handler(
		new Request(`https://maxeisen.me/.netlify/functions/stravaFeed${query}`),
	);
	return { res, body: await res.json() };
}

beforeEach(() => {
	vi.resetModules();
	blobs.clear();
	globalThis.fetch = vi.fn(async (url) => {
		throw new Error(`stravaFeed must not call Strava: ${url}`);
	});
});

describe("stravaFeed", () => {
	it("serves the stored snapshot and never calls Strava", async () => {
		blobs.set("public.json", { activities: [SAMPLE, { ...SAMPLE, id: 43 }] });
		const { res, body } = await payload("?limit=30");

		expect(res.status).toBe(200);
		expect(body.activities).toHaveLength(2);
		expect(body.activities[0]).toEqual(SAMPLE);
		expect(res.headers.get("cache-control")).toMatch(/max-age=300/);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("honors limit", async () => {
		blobs.set("public.json", {
			activities: [SAMPLE, { ...SAMPLE, id: 43 }, { ...SAMPLE, id: 44 }],
		});
		const { body } = await payload("?limit=2");
		expect(body.activities.map((a) => a.id)).toEqual([42, 43]);
	});

	it("returns an empty list before the first sync rather than live-fetching", async () => {
		const { res, body } = await payload();
		expect(res.status).toBe(200);
		expect(body.activities).toEqual([]);
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
