import { describe, it, expect } from "vitest";
import {
	LOAD_AT_THRESHOLD_HOUR,
	heartRateReserve,
	banisterTrimp,
	normalizeTrimp,
	paceLoad,
	activityLoad,
	dailyLoads,
} from "./load.js";

const THRESHOLDS = { maxHr: 191, restingHr: 47, thresholdPaceSecPerKm: 243 };

describe("heartRateReserve", () => {
	it("is 0 at resting and 1 at max", () => {
		expect(heartRateReserve(47, THRESHOLDS)).toBe(0);
		expect(heartRateReserve(191, THRESHOLDS)).toBe(1);
	});

	it("computes the fraction of the usable range", () => {
		expect(heartRateReserve(119, THRESHOLDS)).toBeCloseTo(0.5, 10);
	});

	it("clamps readings outside the athlete's range", () => {
		expect(heartRateReserve(210, THRESHOLDS)).toBe(1);
		expect(heartRateReserve(30, THRESHOLDS)).toBe(0);
	});

	it("returns null without heart rate or a configured range", () => {
		expect(heartRateReserve(undefined, THRESHOLDS)).toBeNull();
		expect(heartRateReserve(150, {})).toBeNull();
		expect(heartRateReserve(150, { maxHr: 100, restingHr: 120 })).toBeNull();
	});

	it("treats an absent reading as absent rather than as zero bpm", () => {
		// Number(null) is 0, which would otherwise clamp to a reserve of 0 and
		// score an unmonitored run as a real, zero-load effort.
		expect(heartRateReserve(null, THRESHOLDS)).toBeNull();
		expect(heartRateReserve("", THRESHOLDS)).toBeNull();
		expect(heartRateReserve(0, THRESHOLDS)).toBeNull();
	});
});

describe("banisterTrimp", () => {
	it("grows faster than linearly with intensity", () => {
		// Same duration, higher HR: the exponential term should more than
		// double the load rather than scaling with the HR ratio.
		const easy = banisterTrimp(3600, 121, THRESHOLDS);
		const hard = banisterTrimp(3600, 173, THRESHOLDS);
		expect(hard / easy).toBeGreaterThan(2);
	});

	it("scales linearly with duration", () => {
		const half = banisterTrimp(1800, 150, THRESHOLDS);
		const full = banisterTrimp(3600, 150, THRESHOLDS);
		expect(full).toBeCloseTo(half * 2, 10);
	});

	it("returns null without usable inputs", () => {
		expect(banisterTrimp(0, 150, THRESHOLDS)).toBeNull();
		expect(banisterTrimp(3600, null, THRESHOLDS)).toBeNull();
	});
});

describe("normalizeTrimp", () => {
	it("puts an hour at threshold heart rate at ~100", () => {
		// HRr 0.85 of a 144-beat reserve is 169.4 bpm for these thresholds.
		const trimp = banisterTrimp(3600, 47 + 0.85 * 144, THRESHOLDS);
		expect(normalizeTrimp(trimp)).toBeCloseTo(LOAD_AT_THRESHOLD_HOUR, 6);
	});
});

describe("paceLoad", () => {
	it("puts an hour at threshold pace at 100", () => {
		expect(paceLoad(3600, 243, 243)).toBeCloseTo(100, 10);
	});

	it("scores running faster than threshold above 100", () => {
		expect(paceLoad(3600, 220, 243)).toBeGreaterThan(100);
	});

	it("scores easy running well below 100", () => {
		expect(paceLoad(3600, 360, 243)).toBeLessThan(70);
	});

	it("returns null without usable inputs", () => {
		expect(paceLoad(3600, 0, 243)).toBeNull();
		expect(paceLoad(0, 300, 243)).toBeNull();
		expect(paceLoad(3600, 300, 0)).toBeNull();
	});
});

describe("activityLoad", () => {
	it("prefers heart rate when it's available", () => {
		const out = activityLoad(
			{ movingTimeSec: 3600, averageHr: 150, gapPaceSecPerKm: 300 },
			THRESHOLDS,
		);
		expect(out.method).toBe("hr");
	});

	it("falls back to pace when heart rate is missing", () => {
		const out = activityLoad({ movingTimeSec: 3600, gapPaceSecPerKm: 243 }, THRESHOLDS);
		expect(out.method).toBe("pace");
		expect(out.load).toBeCloseTo(100, 6);
	});

	it("falls back to pace rather than scoring a null-HR run as zero load", () => {
		const out = activityLoad(
			{ movingTimeSec: 3600, averageHr: null, gapPaceSecPerKm: 243 },
			THRESHOLDS,
		);
		expect(out.method).toBe("pace");
		expect(out.load).toBeGreaterThan(0);
	});

	it("derives GAP itself when the activity carries only splits", () => {
		const out = activityLoad(
			{
				movingTimeSec: 3600,
				splits: [{ distance: 1000, moving_time: 243, elevation_difference: 0 }],
			},
			THRESHOLDS,
		);
		expect(out.method).toBe("pace");
		expect(out.load).toBeCloseTo(100, 6);
	});

	it("keeps the two methods on a comparable scale", () => {
		// The whole point of normalising TRIMP: an hour at threshold should
		// score about the same whether HR was recorded or not, so a week
		// mixing the two doesn't show a phantom spike.
		const byHr = activityLoad({ movingTimeSec: 3600, averageHr: 47 + 0.85 * 144 }, THRESHOLDS);
		const byPace = activityLoad({ movingTimeSec: 3600, gapPaceSecPerKm: 243 }, THRESHOLDS);
		expect(byHr.load).toBeCloseTo(byPace.load, 6);
	});

	it("returns null when there is nothing to score", () => {
		expect(activityLoad({}, THRESHOLDS)).toBeNull();
	});
});

describe("dailyLoads", () => {
	it("sums multiple runs on the same day", () => {
		const out = dailyLoads([
			{ startDateLocal: "2026-08-10T07:00:00Z", load: 60 },
			{ startDateLocal: "2026-08-10T18:00:00Z", load: 40 },
			{ startDateLocal: "2026-08-11T07:00:00Z", load: 25 },
		]);
		expect(out.get("2026-08-10")).toBe(100);
		expect(out.get("2026-08-11")).toBe(25);
	});

	it("ignores entries without a usable local date", () => {
		const out = dailyLoads([{ load: 50 }, { startDateLocal: "nonsense", load: 50 }]);
		expect(out.size).toBe(0);
	});
});
