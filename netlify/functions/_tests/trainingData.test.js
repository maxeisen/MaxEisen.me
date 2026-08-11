// End-to-end privacy assertions for the public training endpoint.
//
// The individual guards are unit-tested in _shared/training/shape.test.js. What
// this file checks is the thing that actually matters: that a payload served
// from a realistic Blobs store — including records the sync should have
// filtered, and records carrying fields it never should have written — contains
// no coordinates and no private runs. The page is public and the risk is a home
// address, so this is asserted against the serialised JSON rather than against
// object shapes, because that's what goes over the wire.

import { describe, it, expect, vi, beforeEach } from "vitest";

const store = { get: vi.fn(), setJSON: vi.fn() };
vi.mock("@netlify/blobs", () => ({ getStore: () => store }));

import { shapeActivities } from "../_shared/training/shape.js";
import { loadPlan } from "../_shared/training/planFile.js";

const LAT = 43.6532;
const LNG = -79.3832;
const POLYLINE = "_p~iF~ps|U_ulLnnqC";

// A raw Strava activity with coordinates in every place Strava puts them.
function rawRun(overrides = {}) {
	return {
		id: 100,
		name: "Morning Run",
		type: "Run",
		sport_type: "Run",
		private: false,
		start_date_local: "2026-08-09T07:00:00Z",
		distance: 10000,
		moving_time: 3000,
		elapsed_time: 3100,
		total_elevation_gain: 60,
		average_heartrate: 150,
		max_heartrate: 170,
		workout_type: 0,
		start_latlng: [LAT, LNG],
		end_latlng: [LAT, LNG],
		location_city: "Toronto",
		location_state: "Ontario",
		map: { id: "a1", summary_polyline: POLYLINE, polyline: POLYLINE },
		splits_metric: [{ distance: 1000, moving_time: 300, elevation_difference: 5 }],
		best_efforts: [{ name: "5k", distance: 5000, elapsed_time: 1450 }],
		...overrides,
	};
}

const PLAN_THRESHOLDS = { maxHr: 195, restingHr: 47, thresholdPaceSecPerKm: 288 };

function seed(records) {
	store.get.mockImplementation(async (key) => (key === "index.json" ? records : null));
}

// Read the body once, as text, and parse from that — the raw JSON is what the
// coordinate assertions need to search, and a Response body can only be
// consumed once.
//
// The handler memoises its payload for a minute, which is right in production
// and would otherwise let the first test's data answer every later one, so each
// call gets a fresh module instance.
async function payload() {
	const { default: handler } = await import("../trainingData.js");
	const res = await handler();
	expect(res.status).toBe(200);
	const text = await res.text();
	return { res, body: JSON.parse(text), text };
}

beforeEach(() => {
	vi.resetModules();
	store.get.mockReset();
	store.setJSON.mockReset();
});

describe("trainingData privacy", () => {
	it("serves no coordinates for activities the sync shaped normally", async () => {
		seed(
			shapeActivities(
				[rawRun(), rawRun({ id: 101, start_date_local: "2026-08-07T07:00:00Z" })],
				{ thresholds: PLAN_THRESHOLDS },
			),
		);

		const { text, body } = await payload();
		expect(body.runs.length).toBeGreaterThan(0);
		expect(text).not.toContain(POLYLINE);
		expect(text).not.toContain(String(LAT));
		expect(text).not.toContain(String(LNG));
		expect(text).not.toMatch(/latlng|polyline|location_city/i);
	});

	it("never serves a private run", async () => {
		seed(
			shapeActivities(
				[
					rawRun({ id: 200, name: "Public Run" }),
					rawRun({ id: 201, name: "Secret Run", private: true }),
				],
				{ thresholds: PLAN_THRESHOLDS },
			),
		);

		const { text, body } = await payload();
		expect(text).not.toContain("Secret Run");
		expect(body.runs.map((r) => r.id)).not.toContain(201);
	});

	// Records are written by whichever version of shape.js was deployed at the
	// time and are served until the sync re-enriches them, so the endpoint must
	// not simply hand back whatever it finds in storage.
	it("strips coordinates that somehow reached storage", async () => {
		const [clean] = shapeActivities([rawRun()], { thresholds: PLAN_THRESHOLDS });
		seed([
			{
				...clean,
				start_latlng: [LAT, LNG],
				map: { summary_polyline: POLYLINE },
				location_city: "Toronto",
			},
		]);

		const { text, body } = await payload();
		expect(body.runs).toHaveLength(1);
		expect(text).not.toContain(POLYLINE);
		expect(text).not.toContain(String(LAT));
		expect(text).not.toMatch(/latlng|polyline|location_city/i);
	});

	it("serves the fields the run log renders", async () => {
		seed(shapeActivities([rawRun()], { thresholds: PLAN_THRESHOLDS }));
		const { body } = await payload();
		const run = body.runs[0];
		for (const field of [
			"id",
			"name",
			"startDateLocal",
			"distanceM",
			"movingTimeSec",
			"paceSecPerKm",
			"gapPaceSecPerKm",
		]) {
			expect(run[field]).not.toBeUndefined();
		}
	});
});

describe("trainingData behaviour", () => {
	it("is publicly cacheable, since there is nothing to gate", async () => {
		seed(shapeActivities([rawRun()], { thresholds: PLAN_THRESHOLDS }));
		const { res } = await payload();
		const cache = res.headers.get("cache-control");
		expect(cache).toContain("public");
		expect(cache).toContain("max-age=600");
		expect(cache).toContain("stale-while-revalidate=1800");
	});

	it("serves an empty dashboard before the first sync has run", async () => {
		seed(null);
		const { body } = await payload();
		expect(body.runs).toEqual([]);
		expect(body.summary.totals.runs).toBe(0);
		expect(Array.isArray(body.recommendations)).toBe(true);
	});

	it("survives a corrupt index rather than taking the page down", async () => {
		seed("not an array");
		const { body } = await payload();
		expect(body.runs).toEqual([]);
	});

	it("reports the race it is counting down to", async () => {
		// Asserted against the plan file rather than a copy of it, so editing
		// the race details is a plan change and not a test failure.
		const { race } = loadPlan();
		seed(shapeActivities([rawRun()], { thresholds: PLAN_THRESHOLDS }));
		const { body } = await payload();
		expect(body.summary.race.name).toBe(race.name);
		expect(body.summary.race.goalTimeSec).toBe(race.goalTimeSec);
	});
});
