import { describe, it, expect } from "vitest";
import {
	RIDE_MIN_M,
	SHAPE_VERSION,
	isTrackableRide,
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

	it("keeps a pace and heart-rate trace while the streams are in hand", () => {
		// The only chance to build it: streams aren't stored, so a record
		// shaped without one can never grow a trace without a re-fetch.
		const seconds = 3000;
		const streams = {
			time: Array.from({ length: seconds }, (_, i) => i),
			distance: Array.from({ length: seconds }, (_, i) => i * (10000 / seconds)),
			heartrate: Array.from({ length: seconds }, () => 150),
			grade_smooth: Array.from({ length: seconds }, () => 4),
		};
		const shaped = shapeActivity(rawRun(), { thresholds: THRESHOLDS, streams });

		expect(shaped.trace.m.length).toBeGreaterThan(shaped.splits.length);
		expect(shaped.trace.pace.every((p) => Math.abs(p - 300) < 5)).toBe(true);

		// Pace and heart rate only. A grade per slice, in distance order, is an
		// elevation profile, and this payload is published — see trace.js.
		expect(Object.keys(shaped.trace).sort()).toEqual(["hr", "m", "pace"]);
	});

	it("gives a ride no trace, for the same reason it gets no splits", () => {
		const streams = { time: [0, 60], distance: [0, 400], heartrate: [130, 132] };
		const shaped = shapeActivity(rawRide(), { thresholds: THRESHOLDS, streams });
		expect(shaped.trace).toBeNull();
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

function rawRide(overrides = {}) {
	return {
		id: 555,
		name: "Evening Ride",
		type: "Ride",
		sport_type: "Ride",
		private: false,
		start_date_local: "2026-08-11T18:00:00Z",
		distance: 45000,
		moving_time: 5400,
		elapsed_time: 5600,
		total_elevation_gain: 320,
		average_heartrate: 138,
		max_heartrate: 165,
		start_latlng: [43.6532, -79.3832],
		map: { summary_polyline: "_p~iF~ps|U_ulLnnqC" },
		...overrides,
	};
}

describe("isTrackableRide", () => {
	it("takes a ride long enough to have cost something", () => {
		expect(isTrackableRide(rawRide())).toBe(true);
		expect(isTrackableRide(rawRide({ sport_type: "GravelRide" }))).toBe(true);
		expect(isTrackableRide(rawRide({ sport_type: "MountainBikeRide" }))).toBe(true);
	});

	it("ignores the commute", () => {
		// The whole point of the threshold: a few kilometres to the office is
		// transport, and letting it through would put a smear of fatigue on
		// most weekdays.
		expect(isTrackableRide(rawRide({ distance: 3000 }))).toBe(false);
		expect(isTrackableRide(rawRide({ distance: RIDE_MIN_M }))).toBe(false);
		expect(isTrackableRide(rawRide({ distance: RIDE_MIN_M + 1 }))).toBe(true);
	});

	it("keeps private rides private", () => {
		expect(isTrackableRide(rawRide({ private: true }))).toBe(false);
	});

	it("is not fooled by a run", () => {
		expect(isTrackableRide(rawRun())).toBe(false);
		expect(isTrackableRun(rawRide())).toBe(false);
	});
});

describe("shapeActivity for rides", () => {
	const shaped = () => shapeActivity(rawRide(), { thresholds: THRESHOLDS });

	it("marks it as a ride so nothing downstream mistakes it for a run", () => {
		expect(shaped().sport).toBe("ride");
		expect(shapeActivity(rawRun(), { thresholds: THRESHOLDS }).sport).toBe("run");
	});

	it("carries no running measures at all", () => {
		const ride = shaped();
		// All of these would be arithmetically fine and completely misleading
		// in a column beside a run's.
		expect(ride.paceSecPerKm).toBeNull();
		expect(ride.gapPaceSecPerKm).toBeNull();
		expect(ride.decouplingPct).toBeNull();
		expect(ride.splits).toEqual([]);
		expect(ride.bestEfforts).toEqual([]);
	});

	it("is left unscored, having nothing to be scored for", () => {
		// A ride is stored to be listed, and counted by nothing on the page.
		// Scoring it anyway would leave a plausible number in the record for
		// some later sum to pick up by accident. Heart rate is present here,
		// so this fails if the load line ever stops asking whether it's a ride.
		const ride = shaped();
		expect(ride.averageHr).toBe(138);
		expect(ride.load).toBe(0);
		expect(ride.loadMethod).toBeNull();
	});

	it("drops a ride's route just as thoroughly", () => {
		const json = JSON.stringify(shaped());
		expect(json).not.toContain("43.65");
		expect(json).not.toContain("_p~iF");
		expect(json).not.toContain("polyline");
	});
});
