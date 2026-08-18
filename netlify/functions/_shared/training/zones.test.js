import { describe, it, expect } from "vitest";
import {
	hrZoneFloors,
	zoneOfHr,
	zoneSecondsFromStreams,
	classifyByPace,
	intensitySplit,
} from "./zones.js";

const THRESHOLDS = { maxHr: 195, restingHr: 47, thresholdPaceSecPerKm: 288, marathonPaceSecPerKm: 313 };

// Karvonen floors for max 195 / resting 47 (a reserve of 148).
const RESERVE_FLOORS = [0, 135.8, 150.6, 165.4, 180.2];

describe("hrZoneFloors", () => {
	it("anchors on lactate threshold when the plan file knows one", () => {
		const floors = hrZoneFloors({ ...THRESHOLDS, lactateThresholdHr: 175 });
		expect(floors).toEqual([0, 150.5, 157.5, 166.25, 175]);
	});

	it("prefers a measured threshold to zones nobody chose", () => {
		// Strava hands out a full set of zones to an athlete who has never
		// opened that screen, so "configured" doesn't mean decided. A
		// threshold in the plan file was measured and written down.
		const configured = [{ min: 0 }, { min: 128 }, { min: 159 }, { min: 175 }, { min: 190 }];
		const floors = hrZoneFloors({ ...THRESHOLDS, lactateThresholdHr: 175 }, configured);
		expect(floors[2]).toBe(157.5);
	});

	it("puts the easy ceiling below threshold rather than above it", () => {
		// The bug this replaced: derived from the ends of the range, zone 3
		// began at 151 for an athlete whose threshold is 175, so steady
		// aerobic running was reported as tempo.
		const [, , moderate] = hrZoneFloors({ ...THRESHOLDS, lactateThresholdHr: 175 });
		expect(moderate).toBeGreaterThan(RESERVE_FLOORS[2]);
		expect(moderate).toBeLessThan(175);
	});

	it("derives floors from heart-rate reserve when resting HR is known", () => {
		const floors = hrZoneFloors(THRESHOLDS);
		expect(floors).toHaveLength(5);
		floors.forEach((f, i) => expect(f).toBeCloseTo(RESERVE_FLOORS[i], 6));
	});

	it("sits above the percent-of-max equivalent", () => {
		// The whole reason for using reserve: with a low resting HR,
		// percent-of-max puts the boundaries far too low and books easy
		// running as tempo.
		const reserve = hrZoneFloors(THRESHOLDS);
		const percentOfMax = hrZoneFloors({ maxHr: 195 });
		for (let i = 1; i < 5; i++) {
			expect(reserve[i]).toBeGreaterThan(percentOfMax[i]);
		}
	});

	it("falls back to percent of max when resting HR is unknown", () => {
		expect(hrZoneFloors({ maxHr: 195 })).toEqual([0, 117, 136.5, 156, 175.5]);
	});

	it("ignores a nonsensical resting HR", () => {
		expect(hrZoneFloors({ maxHr: 195, restingHr: 200 })).toEqual([0, 117, 136.5, 156, 175.5]);
		expect(hrZoneFloors({ maxHr: 195, restingHr: 0 })).toEqual([0, 117, 136.5, 156, 175.5]);
	});

	it("prefers the athlete's configured zones over any derivation", () => {
		const configured = [{ min: 0 }, { min: 120 }, { min: 145 }, { min: 165 }, { min: 180 }];
		expect(hrZoneFloors(THRESHOLDS, configured)).toEqual([0, 120, 145, 165, 180]);
	});

	it("ignores configured zones with a missing floor", () => {
		const broken = [{ min: 0 }, { min: null }, { min: 145 }, { min: 165 }, { min: 180 }];
		const floors = hrZoneFloors(THRESHOLDS, broken);
		floors.forEach((f, i) => expect(f).toBeCloseTo(RESERVE_FLOORS[i], 6));
	});

	it("ignores configured zones that don't ascend", () => {
		const broken = [{ min: 0 }, { min: 160 }, { min: 145 }, { min: 165 }, { min: 180 }];
		const floors = hrZoneFloors(THRESHOLDS, broken);
		floors.forEach((f, i) => expect(f).toBeCloseTo(RESERVE_FLOORS[i], 6));
	});

	it("returns null with no max heart rate to work from", () => {
		expect(hrZoneFloors({})).toBeNull();
	});
});

describe("zoneOfHr", () => {
	const floors = [0, 117, 136.5, 156, 175.5];

	it("places readings in the right zone", () => {
		expect(zoneOfHr(100, floors)).toBe(1);
		expect(zoneOfHr(130, floors)).toBe(2);
		expect(zoneOfHr(150, floors)).toBe(3);
		expect(zoneOfHr(170, floors)).toBe(4);
		expect(zoneOfHr(185, floors)).toBe(5);
	});

	it("treats a floor as belonging to the zone above", () => {
		expect(zoneOfHr(117, floors)).toBe(2);
	});

	it("returns null without a reading rather than defaulting to zone 1", () => {
		// Gaps in the heart-rate trace must not be booked as easy running.
		expect(zoneOfHr(null, floors)).toBeNull();
		expect(zoneOfHr(undefined, floors)).toBeNull();
		expect(zoneOfHr(0, floors)).toBeNull();
	});
});

describe("zoneSecondsFromStreams", () => {
	const floors = [0, 117, 136.5, 156, 175.5];

	// A watch recording once a second, which is what one does.
	function recorded(spells) {
		const time = [0];
		const heartrate = [spells[0].hr];
		for (const { hr, sec } of spells) {
			for (let i = 0; i < sec; i++) {
				time.push(time.at(-1) + 1);
				heartrate.push(hr);
			}
		}
		return { time, heartrate };
	}

	it("accumulates time per zone from stream deltas", () => {
		const out = zoneSecondsFromStreams(
			recorded([
				{ hr: 100, sec: 60 },
				{ hr: 150, sec: 60 },
				{ hr: 180, sec: 60 },
			]),
			floors,
		);
		expect(out[0]).toBe(60); // zone 1
		expect(out[2]).toBe(60); // zone 3
		expect(out[4]).toBe(60); // zone 5
	});

	it("doesn't book a paused watch as time in a zone", () => {
		// A second of hard running, ten minutes standing while the watch wrote
		// nothing at all, then a second more. The stop arrives as a single
		// interval, and counting it would file all ten minutes under the low
		// heart rate recording resumed at — which is how an interval session
		// with standing rests reported itself as half easy running.
		const out = zoneSecondsFromStreams(
			{ time: [0, 1, 601, 602], heartrate: [180, 180, 120, 120] },
			floors,
		);
		expect(out[4]).toBe(1);
		expect(out[1]).toBe(1);
		// And the ten minutes are nowhere: not easy, not hard, not anywhere.
		expect(out.reduce((a, b) => a + b, 0)).toBe(2);
	});

	it("returns null when there's no heart-rate stream", () => {
		expect(zoneSecondsFromStreams({ time: [0, 60] }, floors)).toBeNull();
		expect(zoneSecondsFromStreams(null, floors)).toBeNull();
	});
});

describe("classifyByPace", () => {
	it("calls threshold pace and faster hard", () => {
		expect(classifyByPace(288, THRESHOLDS)).toBe("hard");
		expect(classifyByPace(260, THRESHOLDS)).toBe("hard");
	});

	it("calls comfortably slower than marathon pace easy", () => {
		expect(classifyByPace(360, THRESHOLDS)).toBe("easy");
	});

	it("calls the band just off marathon pace moderate", () => {
		expect(classifyByPace(320, THRESHOLDS)).toBe("moderate");
	});

	it("returns null without a threshold to compare against", () => {
		expect(classifyByPace(300, {})).toBeNull();
	});
});

describe("intensitySplit", () => {
	it("sums time in zone into easy, moderate and hard bands", () => {
		const out = intensitySplit(
			[{ zoneSeconds: [1200, 2400, 600, 300, 100] }],
			THRESHOLDS,
		);
		expect(out.easySec).toBe(3600); // zones 1-2
		expect(out.moderateSec).toBe(600); // zone 3
		expect(out.hardSec).toBe(400); // zones 4-5
		expect(out.easyPct).toBeCloseTo(78.26, 1);
	});

	it("falls back to pace classification for runs without heart rate", () => {
		const out = intensitySplit(
			[{ movingTimeSec: 3600, gapPaceSecPerKm: 380 }],
			THRESHOLDS,
		);
		expect(out.easySec).toBe(3600);
		expect(out.easyPct).toBe(100);
	});

	it("counts both kinds of run in one distribution", () => {
		const out = intensitySplit(
			[
				{ zoneSeconds: [0, 3600, 0, 0, 0] },
				{ movingTimeSec: 1800, gapPaceSecPerKm: 270 },
			],
			THRESHOLDS,
		);
		expect(out.easySec).toBe(3600);
		expect(out.hardSec).toBe(1800);
		expect(out.totalSec).toBe(5400);
	});

	it("reports nulls rather than dividing by an empty history", () => {
		const out = intensitySplit([], THRESHOLDS);
		expect(out.totalSec).toBe(0);
		expect(out.easyPct).toBeNull();
	});
});
