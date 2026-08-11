import { describe, it, expect } from "vitest";
import {
	SHAPE_VERSION,
	isTrackableRun,
	shapeActivity,
	shapeActivities,
	collectBestEfforts,
} from "./shape.js";

const THRESHOLDS = { maxHr: 195, restingHr: 47, thresholdPaceSecPerKm: 288, marathonPaceSecPerKm: 313 };

// A raw activity seeded with coordinates everywhere Strava puts them, so the
// privacy assertions below have something real to catch.
function rawRun(overrides = {}) {
	return {
		id: 123,
		name: "Morning Run",
		type: "Run",
		sport_type: "Run",
		private: false,
		start_date_local: "2026-08-11T07:00:00Z",
		distance: 10000,
		moving_time: 3000,
		elapsed_time: 3100,
		total_elevation_gain: 80,
		average_heartrate: 150,
		max_heartrate: 172,
		average_cadence: 88,
		suffer_score: 61,
		workout_type: 0,
		start_latlng: [43.6532, -79.3832],
		end_latlng: [43.6541, -79.3801],
		location_city: "Toronto",
		map: { id: "a123", summary_polyline: "_p~iF~ps|U_ulLnnqC", polyline: "_p~iF~ps|U_ulLnnqC" },
		splits_metric: [
			{ distance: 1000, moving_time: 300, elevation_difference: 10, average_heartrate: 148 },
			{ distance: 1000, moving_time: 300, elevation_difference: -10, average_heartrate: 152 },
		],
		best_efforts: [
			{ name: "5k", distance: 5000, elapsed_time: 1450 },
			{ name: "10k", distance: 10000, elapsed_time: 2980 },
		],
		...overrides,
	};
}

describe("isTrackableRun", () => {
	it("accepts runs, trail runs and treadmill runs", () => {
		expect(isTrackableRun({ sport_type: "Run" })).toBe(true);
		expect(isTrackableRun({ sport_type: "TrailRun" })).toBe(true);
		expect(isTrackableRun({ sport_type: "VirtualRun" })).toBe(true);
	});

	it("rejects other sports", () => {
		expect(isTrackableRun({ sport_type: "Ride" })).toBe(false);
		expect(isTrackableRun({ sport_type: "WeightTraining" })).toBe(false);
	});

	it("rejects private activities", () => {
		expect(isTrackableRun({ sport_type: "Run", private: true })).toBe(false);
	});

	it("rejects nothing at all", () => {
		expect(isTrackableRun(null)).toBe(false);
	});
});

describe("shapeActivity privacy guarantees", () => {
	it("drops a private run entirely", () => {
		// The page is public and the token can see private runs, so this
		// filter is the only thing keeping them off the open web.
		expect(shapeActivity(rawRun({ private: true }), { thresholds: THRESHOLDS })).toBeNull();
	});

	it("carries no coordinates anywhere in the output", () => {
		const shaped = shapeActivity(rawRun(), { thresholds: THRESHOLDS });
		const json = JSON.stringify(shaped);
		expect(json).not.toContain("43.65");
		expect(json).not.toContain("-79.38");
		expect(json).not.toContain("_p~iF");
		expect(json).not.toContain("polyline");
		expect(json).not.toContain("latlng");
	});

	it("keeps no map object or location fields", () => {
		const shaped = shapeActivity(rawRun(), { thresholds: THRESHOLDS });
		expect(shaped.map).toBeUndefined();
		expect(shaped.start_latlng).toBeUndefined();
		expect(shaped.location_city).toBeUndefined();
	});

	it("does not pass through unrecognised fields added upstream", () => {
		// Allow-list by construction: if Strava adds a field tomorrow, it
		// should not appear in the public payload without a code change.
		const shaped = shapeActivity(
			rawRun({ some_future_private_field: "home address" }),
			{ thresholds: THRESHOLDS },
		);
		expect(JSON.stringify(shaped)).not.toContain("home address");
	});
});

describe("shapeActivity", () => {
	it("stamps the shape version so stale records can be re-enriched", () => {
		// trainingSync re-fetches anything whose version doesn't match. Without
		// the stamp every stored record looks current forever, and derived
		// fields computed from streams we no longer hold could never be fixed.
		expect(shapeActivity(rawRun(), { thresholds: THRESHOLDS }).v).toBe(SHAPE_VERSION);
		expect(Number.isInteger(SHAPE_VERSION)).toBe(true);
	});

	it("keeps the metrics the dashboard needs", () => {
		const shaped = shapeActivity(rawRun(), { thresholds: THRESHOLDS });
		expect(shaped.id).toBe(123);
		expect(shaped.distanceM).toBe(10000);
		expect(shaped.movingTimeSec).toBe(3000);
		expect(shaped.averageHr).toBe(150);
		expect(shaped.paceSecPerKm).toBeCloseTo(300, 6);
		expect(shaped.elevationGainM).toBe(80);
	});

	it("computes GAP from splits when there are no streams", () => {
		const shaped = shapeActivity(rawRun(), { thresholds: THRESHOLDS });
		expect(shaped.gapSource).toBe("splits");
		expect(shaped.gapPaceSecPerKm).toBeGreaterThan(0);
	});

	it("prefers streams for GAP and computes time in zone from them", () => {
		const streams = {
			time: [0, 60, 120, 180],
			distance: [0, 200, 400, 600],
			heartrate: [140, 140, 160, 180],
			grade_smooth: [0, 0, 0, 0],
		};
		const shaped = shapeActivity(rawRun(), { thresholds: THRESHOLDS, streams });
		expect(shaped.gapSource).toBe("streams");
		expect(shaped.zoneSeconds).toHaveLength(5);
		expect(shaped.zoneSeconds.reduce((a, b) => a + b, 0)).toBe(180);
	});

	it("scores load by heart rate when present", () => {
		const shaped = shapeActivity(rawRun(), { thresholds: THRESHOLDS });
		expect(shaped.loadMethod).toBe("hr");
		expect(shaped.load).toBeGreaterThan(0);
	});

	it("falls back to pace-based load without heart rate", () => {
		const shaped = shapeActivity(
			rawRun({ average_heartrate: undefined }),
			{ thresholds: THRESHOLDS },
		);
		expect(shaped.loadMethod).toBe("pace");
		expect(shaped.load).toBeGreaterThan(0);
	});

	it("keeps best efforts as distances and times", () => {
		const shaped = shapeActivity(rawRun(), { thresholds: THRESHOLDS });
		expect(shaped.bestEfforts).toEqual([
			{ name: "5k", distanceM: 5000, timeSec: 1450, date: "2026-08-11" },
			{ name: "10k", distanceM: 10000, timeSec: 2980, date: "2026-08-11" },
		]);
	});

	it("shapes splits with their own grade-adjusted pace", () => {
		const shaped = shapeActivity(rawRun(), { thresholds: THRESHOLDS });
		expect(shaped.splits).toHaveLength(2);
		expect(shaped.splits[0].km).toBe(1);
		// First km climbs 10m, so its GAP should be faster than raw pace.
		expect(shaped.splits[0].gapPaceSecPerKm).toBeLessThan(shaped.splits[0].paceSecPerKm);
		// Second km descends, so the reverse.
		expect(shaped.splits[1].gapPaceSecPerKm).toBeGreaterThan(shaped.splits[1].paceSecPerKm);
	});

	it("returns null for an activity with no distance or time", () => {
		expect(shapeActivity(rawRun({ distance: 0 }), { thresholds: THRESHOLDS })).toBeNull();
		expect(shapeActivity(rawRun({ moving_time: 0 }), { thresholds: THRESHOLDS })).toBeNull();
	});
});

describe("shapeActivities", () => {
	it("filters out private runs and other sports in a batch", () => {
		const out = shapeActivities(
			[
				rawRun({ id: 1 }),
				rawRun({ id: 2, private: true }),
				rawRun({ id: 3, sport_type: "Ride" }),
				rawRun({ id: 4 }),
			],
			{ thresholds: THRESHOLDS },
		);
		expect(out.map((a) => a.id)).toEqual([1, 4]);
	});
});

describe("collectBestEfforts", () => {
	it("gathers efforts across activities, newest first", () => {
		const out = collectBestEfforts([
			{ bestEfforts: [{ name: "5k", distanceM: 5000, timeSec: 1500, date: "2026-07-01" }] },
			{ bestEfforts: [{ name: "5k", distanceM: 5000, timeSec: 1450, date: "2026-08-01" }] },
		]);
		expect(out.map((e) => e.date)).toEqual(["2026-08-01", "2026-07-01"]);
	});

	it("handles activities with no efforts", () => {
		expect(collectBestEfforts([{}, { bestEfforts: [] }])).toEqual([]);
	});
});
