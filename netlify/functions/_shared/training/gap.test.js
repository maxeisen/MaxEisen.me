import { describe, it, expect } from "vitest";
import {
	FLAT_COST,
	GRADE_CLAMP,
	costOfRunning,
	gradeFactor,
	gradeAdjustedSpeed,
	gapFromSegments,
	segmentsFromSplits,
	segmentsFromStreams,
	activityGap,
} from "./gap.js";

describe("costOfRunning", () => {
	it("returns the flat cost at zero gradient", () => {
		expect(costOfRunning(0)).toBeCloseTo(FLAT_COST, 10);
	});

	it("costs more uphill and less on a shallow descent", () => {
		expect(costOfRunning(0.1)).toBeGreaterThan(FLAT_COST);
		expect(costOfRunning(-0.1)).toBeLessThan(FLAT_COST);
	});

	it("bottoms out around -20% and rises again on steeper descents", () => {
		// The signature non-monotonicity of the Minetti curve: braking on a
		// steep downhill costs energy, so -30% is dearer than -20%.
		expect(costOfRunning(-0.2)).toBeLessThan(costOfRunning(-0.1));
		expect(costOfRunning(-0.3)).toBeGreaterThan(costOfRunning(-0.2));
	});

	it("clamps beyond the range the curve was fitted over", () => {
		expect(costOfRunning(0.9)).toBe(costOfRunning(GRADE_CLAMP));
		expect(costOfRunning(-0.9)).toBe(costOfRunning(-GRADE_CLAMP));
	});

	it("treats missing gradient as flat", () => {
		expect(costOfRunning(undefined)).toBeCloseTo(FLAT_COST, 10);
		expect(costOfRunning(null)).toBeCloseTo(FLAT_COST, 10);
	});
});

describe("gradeFactor", () => {
	it("is 1 on the flat", () => {
		expect(gradeFactor(0)).toBeCloseTo(1, 10);
	});

	it("is roughly 1.66 at 10% uphill", () => {
		expect(gradeFactor(0.1)).toBeCloseTo(1.658, 2);
	});
});

describe("gradeAdjustedSpeed", () => {
	it("reports a faster equivalent flat speed when climbing", () => {
		expect(gradeAdjustedSpeed(3, 0.1)).toBeGreaterThan(3);
	});

	it("leaves flat running untouched", () => {
		expect(gradeAdjustedSpeed(3, 0)).toBeCloseTo(3, 10);
	});
});

describe("gapFromSegments", () => {
	it("leaves GAP equal to raw pace on flat ground", () => {
		const out = gapFromSegments([
			{ distanceM: 1000, timeSec: 300, gradient: 0 },
			{ distanceM: 1000, timeSec: 300, gradient: 0 },
		]);
		expect(out.gapPaceSecPerKm).toBeCloseTo(300, 6);
		expect(out.paceSecPerKm).toBeCloseTo(300, 6);
		expect(out.distanceM).toBe(2000);
	});

	it("credits a climb with a faster grade-adjusted pace than was run", () => {
		const out = gapFromSegments([{ distanceM: 1000, timeSec: 360, gradient: 0.08 }]);
		expect(out.paceSecPerKm).toBeCloseTo(360, 6);
		expect(out.gapPaceSecPerKm).toBeLessThan(360);
	});

	it("penalises a shallow descent with a slower grade-adjusted pace", () => {
		const out = gapFromSegments([{ distanceM: 1000, timeSec: 300, gradient: -0.08 }]);
		expect(out.gapPaceSecPerKm).toBeGreaterThan(300);
	});

	it("cancels out over a symmetric there-and-back", () => {
		// Same hill up and down: the adjustment should land near the flat
		// equivalent rather than favouring either direction.
		const out = gapFromSegments([
			{ distanceM: 1000, timeSec: 360, gradient: 0.05 },
			{ distanceM: 1000, timeSec: 260, gradient: -0.05 },
		]);
		expect(out.gapPaceSecPerKm).toBeGreaterThan(280);
		expect(out.gapPaceSecPerKm).toBeLessThan(330);
	});

	it("does not book a net-flat rolling route as slower than it was run", () => {
		// Climbs and descents of the same size in equal measure, which is what
		// a per-second grade stream looks like on undulating ground and on
		// altimeter noise alike. Rolling terrain costs something, so GAP has
		// to land on the fast side of raw pace. Aggregating the reciprocal
		// instead put it 12s/km on the slow side of a real 10km.
		const segments = [];
		for (let i = 0; i < 20; i++) {
			segments.push({ distanceM: 100, timeSec: 33, gradient: 0.12 });
			segments.push({ distanceM: 100, timeSec: 27, gradient: -0.12 });
		}
		const out = gapFromSegments(segments);
		expect(out.paceSecPerKm).toBeCloseTo(300, 6);
		expect(out.gapPaceSecPerKm).toBeLessThan(out.paceSecPerKm);
	});

	it("skips zero-distance and zero-time segments", () => {
		const out = gapFromSegments([
			{ distanceM: 1000, timeSec: 300, gradient: 0 },
			{ distanceM: 0, timeSec: 120, gradient: 0 }, // standing still
			{ distanceM: 50, timeSec: 0, gradient: 0 }, // clock stopped
		]);
		expect(out.distanceM).toBe(1000);
		expect(out.timeSec).toBe(300);
	});

	it("returns null when there's nothing measurable", () => {
		expect(gapFromSegments([])).toBeNull();
		expect(gapFromSegments(null)).toBeNull();
		expect(gapFromSegments([{ distanceM: 0, timeSec: 0, gradient: 0 }])).toBeNull();
	});
});

describe("segmentsFromSplits", () => {
	it("derives gradient from each split's elevation change", () => {
		const segs = segmentsFromSplits([
			{ distance: 1000, moving_time: 300, elevation_difference: 50 },
		]);
		expect(segs).toEqual([{ distanceM: 1000, timeSec: 300, gradient: 0.05 }]);
	});

	it("treats a missing elevation difference as flat", () => {
		const segs = segmentsFromSplits([{ distance: 1000, moving_time: 300 }]);
		expect(segs[0].gradient).toBe(0);
	});

	it("drops unusable splits", () => {
		expect(segmentsFromSplits([{ distance: 0, moving_time: 300 }])).toEqual([]);
		expect(segmentsFromSplits(undefined)).toEqual([]);
	});
});

describe("segmentsFromStreams", () => {
	it("differences cumulative streams and converts percent grade", () => {
		const segs = segmentsFromStreams({
			time: [0, 60, 120],
			distance: [0, 200, 400],
			grade_smooth: [0, 5, -5],
		});
		expect(segs).toEqual([
			{ distanceM: 200, timeSec: 60, gradient: 0.05 },
			{ distanceM: 200, timeSec: 60, gradient: -0.05 },
		]);
	});

	it("falls back to the altitude delta when grade is absent", () => {
		const segs = segmentsFromStreams({
			time: [0, 60],
			distance: [0, 200],
			altitude: [100, 110],
		});
		expect(segs[0].gradient).toBeCloseTo(0.05, 10);
	});

	it("returns nothing without the required streams", () => {
		expect(segmentsFromStreams({ time: [0, 1] })).toEqual([]);
		expect(segmentsFromStreams(null)).toEqual([]);
	});
});

describe("activityGap", () => {
	it("prefers streams over splits", () => {
		const out = activityGap({
			streams: { time: [0, 300], distance: [0, 1000], grade_smooth: [0, 0] },
			splits: [{ distance: 1000, moving_time: 600, elevation_difference: 0 }],
		});
		expect(out.source).toBe("streams");
		expect(out.gapPaceSecPerKm).toBeCloseTo(300, 6);
	});

	it("falls back to splits when streams are missing", () => {
		const out = activityGap({
			splits: [{ distance: 1000, moving_time: 300, elevation_difference: 0 }],
		});
		expect(out.source).toBe("splits");
	});

	it("falls back to flat pace when there is neither", () => {
		const out = activityGap({ distanceM: 5000, movingTimeSec: 1500 });
		expect(out.source).toBe("flat");
		expect(out.gapPaceSecPerKm).toBeCloseTo(300, 6);
	});

	it("returns null for an activity with no usable data", () => {
		expect(activityGap({})).toBeNull();
	});

	// Strava's `time` stream is elapsed, so a run with any stopped time has
	// samples that aren't running. Left in, these were doubling GAP on real
	// runs — a 5:36/km easy run was reporting 11:19/km.
	it("ignores a long stop where the GPS drifts", () => {
		const out = activityGap({
			distanceM: 2000,
			movingTimeSec: 600,
			streams: {
				// 1 km at 5:00, a 10-minute stop drifting 3 m, then 1 km at 5:00.
				time: [0, 300, 900, 1200],
				distance: [0, 1000, 1003, 2000],
				grade_smooth: [0, 0, 0, 0],
			},
		});
		expect(out.gapPaceSecPerKm).toBeCloseTo(300, 0);
	});

	it("ignores a GPS jump", () => {
		const out = activityGap({
			distanceM: 2000,
			movingTimeSec: 600,
			streams: {
				// A 500 m teleport in one second on re-acquisition.
				time: [0, 300, 301, 600],
				distance: [0, 1000, 1500, 2000],
				grade_smooth: [0, 0, 0, 0],
			},
		});
		expect(out.gapPaceSecPerKm).toBeCloseTo(300, 0);
	});

	// The bug this anchoring fixes: GAP was derived from summed stream deltas
	// while the pace shown next to it came from moving time, so the two could
	// disagree even on ground with no gradient at all.
	it("matches raw pace on the flat however patchy the stream is", () => {
		const out = activityGap({
			distanceM: 10000,
			movingTimeSec: 3000,
			streams: {
				// Only a third of the run is covered by usable samples.
				time: [0, 300, 600],
				distance: [0, 1000, 2000],
				grade_smooth: [0, 0, 0],
			},
		});
		expect(out.paceSecPerKm).toBeCloseTo(300, 6);
		expect(out.gapPaceSecPerKm).toBeCloseTo(300, 6);
	});

	it("still credits gradient once anchored to moving time", () => {
		const out = activityGap({
			distanceM: 1000,
			movingTimeSec: 300,
			streams: { time: [0, 300], distance: [0, 1000], grade_smooth: [5, 5] },
		});
		// Uphill running is worth a faster flat pace, so GAP beats raw pace.
		expect(out.gapPaceSecPerKm).toBeLessThan(300);
		expect(out.adjustment).toBeCloseTo(1 / gradeFactor(0.05), 6);
	});
});
