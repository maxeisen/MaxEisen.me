import { describe, it, expect } from "vitest";
import {
	HRV_DROP_PCT,
	RHR_RISE_BPM,
	SLEEP_TARGET_SEC,
	recoverySummary,
	shapeNight,
	shapeRecovery,
	windowMean,
} from "./recovery.js";
import { addDays } from "./dates.js";

const HOURS = (h) => Math.round(h * 3600);

function period(overrides = {}) {
	return {
		day: "2026-08-11",
		type: "long_sleep",
		"total_sleep_duration": HOURS(7.5),
		"time_in_bed": HOURS(8),
		efficiency: 91,
		latency: 600,
		"rem_sleep_duration": HOURS(1.6),
		"deep_sleep_duration": HOURS(1.2),
		"lowest_heart_rate": 47,
		"average_hrv": 62,
		...overrides,
	};
}

describe("shapeNight", () => {
	it("reads the night off the main sleep period", () => {
		const night = shapeNight({
			day: "2026-08-11",
			periods: [period()],
			dailySleep: { day: "2026-08-11", score: 84 },
			readiness: { day: "2026-08-11", score: 79, "temperature_deviation": 0.2 },
		});

		expect(night.sleepSec).toBe(HOURS(7.5));
		expect(night.restingHr).toBe(47);
		expect(night.averageHrv).toBe(62);
		expect(night.sleepScore).toBe(84);
		expect(night.readinessScore).toBe(79);
		expect(night.temperatureDeviationC).toBe(0.2);
	});

	it("ignores naps", () => {
		// A nap's lowest heart rate is not your overnight resting rate, and
		// counting one towards the total says you slept well when in fact you
		// slept twice.
		const night = shapeNight({
			day: "2026-08-11",
			periods: [period(), period({ type: "late_nap", "total_sleep_duration": HOURS(1), "lowest_heart_rate": 58 })],
		});
		expect(night.sleepSec).toBe(HOURS(7.5));
		expect(night.restingHr).toBe(47);
	});

	it("sums a night that was recorded in two halves", () => {
		const night = shapeNight({
			day: "2026-08-11",
			periods: [
				period({ "total_sleep_duration": HOURS(5) }),
				period({ "total_sleep_duration": HOURS(2), "lowest_heart_rate": 52 }),
			],
		});
		expect(night.sleepSec).toBe(HOURS(7));
		// The longer half carries the heart-rate figures.
		expect(night.restingHr).toBe(47);
	});

	it("has nothing to say about a day with no main sleep", () => {
		expect(shapeNight({ day: "2026-08-11", periods: [] })).toBeNull();
		expect(shapeNight({ day: "2026-08-11", periods: [period({ type: "late_nap" })] })).toBeNull();
		expect(
			shapeNight({ day: "2026-08-11", periods: [period({ "total_sleep_duration": 0 })] }),
		).toBeNull();
	});
});

describe("shapeRecovery", () => {
	it("joins the three collections by day, oldest first", () => {
		const nights = shapeRecovery({
			sleep: [period({ day: "2026-08-11" }), period({ day: "2026-08-09" })],
			dailySleep: [{ day: "2026-08-09", score: 70 }],
			readiness: [{ day: "2026-08-11", score: 88 }],
		});

		expect(nights.map((n) => n.day)).toEqual(["2026-08-09", "2026-08-11"]);
		expect(nights[0].sleepScore).toBe(70);
		expect(nights[0].readinessScore).toBeNull();
		expect(nights[1].readinessScore).toBe(88);
	});
});

describe("windowMean", () => {
	const nights = [
		{ day: "2026-08-09", sleepSec: HOURS(6) },
		{ day: "2026-08-10", sleepSec: HOURS(8) },
		{ day: "2026-08-11", sleepSec: HOURS(7) },
	];

	it("averages the window", () => {
		expect(windowMean(nights, "sleepSec", { to: "2026-08-11", days: 3 }).mean).toBe(HOURS(7));
	});

	it("skips missing nights rather than counting them as no sleep", () => {
		// The opposite of how daily training load works, and the difference
		// matters: a day with no run really is a day of no load, but a night
		// with no record is a ring left on a bedside table. Averaging it in as
		// zero would manufacture the exact alarm this is meant to raise.
		const withGap = [
			{ day: "2026-08-05", sleepSec: HOURS(8) },
			{ day: "2026-08-10", sleepSec: HOURS(8) },
			{ day: "2026-08-11", sleepSec: HOURS(8) },
		];
		const out = windowMean(withGap, "sleepSec", { to: "2026-08-11", days: 7 });
		expect(out.mean).toBe(HOURS(8));
		expect(out.nights).toBe(3);
	});

	it("says nothing rather than averaging one or two nights", () => {
		const sparse = [{ day: "2026-08-11", sleepSec: HOURS(4) }];
		expect(windowMean(sparse, "sleepSec", { to: "2026-08-11", days: 7 }).mean).toBeNull();
	});

	it("ignores a field the night doesn't carry", () => {
		const noHrv = [
			{ day: "2026-08-09", averageHrv: 60 },
			{ day: "2026-08-10" },
			{ day: "2026-08-11", averageHrv: 70 },
		];
		const out = windowMean(noHrv, "averageHrv", { to: "2026-08-11", days: 7 });
		expect(out.nights).toBe(2);
		expect(out.mean).toBeNull(); // two readings is under the floor
	});
});

// A month of identical nights, so a test only has to say how the recent ones
// differed from the established normal.
function block(today, { sleepSec = HOURS(8), restingHr = 48, averageHrv = 65, days = 28 } = {}) {
	return Array.from({ length: days }, (_, i) => ({
		day: addDays(today, -(days - 1 - i)),
		sleepSec,
		restingHr,
		averageHrv,
	}));
}

// Replace the last seven nights, leaving the baseline behind them intact.
function recent(nights, patch) {
	return nights.map((n, i) => (i >= nights.length - 7 ? { ...n, ...patch } : n));
}

describe("recoverySummary", () => {
	const TODAY = "2026-08-11";

	it("has nothing to say without any nights", () => {
		expect(recoverySummary([], { today: TODAY })).toBeNull();
	});

	it("reads level when nothing has changed", () => {
		const out = recoverySummary(block(TODAY), { today: TODAY });
		expect(out.sleep.recent).toBe(HOURS(8));
		expect(out.sleep.baseline).toBe(HOURS(8));
		expect(out.sleep.delta).toBe(0);
		expect(out.restingHr.delta).toBe(0);
	});

	it("measures the last week against the month behind it", () => {
		const out = recoverySummary(recent(block(TODAY), { sleepSec: HOURS(6) }), { today: TODAY });
		expect(out.sleep.recent).toBe(HOURS(6));
		// The baseline is the whole 28 days, recent week included, which is
		// the same acute-against-chronic shape ACWR uses.
		expect(out.sleep.baseline).toBeLessThan(HOURS(8));
		expect(out.sleep.delta).toBeLessThan(0);
		expect(out.sleep.recent).toBeLessThan(SLEEP_TARGET_SEC);
	});

	it("catches a resting heart rate that has climbed", () => {
		const out = recoverySummary(recent(block(TODAY), { restingHr: 56 }), { today: TODAY });
		expect(out.restingHr.delta).toBeGreaterThanOrEqual(RHR_RISE_BPM);
	});

	it("catches heart-rate variability falling away", () => {
		const out = recoverySummary(recent(block(TODAY), { averageHrv: 40 }), { today: TODAY });
		expect(out.hrv.deltaPct).toBeLessThanOrEqual(-HRV_DROP_PCT);
	});

	it("ignores anything logged after today", () => {
		const nights = [...block(TODAY), { day: "2026-08-20", sleepSec: HOURS(1), restingHr: 90 }];
		const out = recoverySummary(nights, { today: TODAY });
		expect(out.latest.day).toBe(TODAY);
		expect(out.series.every((n) => n.day <= TODAY)).toBe(true);
	});

	it("dates the latest night, which needn't be last night", () => {
		// Before the ring syncs in the morning, the most recent night on
		// record is the one before — the panel says which rather than
		// implying it's current.
		const nights = block(TODAY).slice(0, -1);
		const out = recoverySummary(nights, { today: TODAY });
		expect(out.latest.day).toBe(addDays(TODAY, -1));
	});

	it("serves a month of nights and no more", () => {
		const out = recoverySummary(block(TODAY, { days: 90 }), { today: TODAY });
		expect(out.series).toHaveLength(28);
		// And nothing beyond what the panel draws.
		expect(Object.keys(out.series[0]).sort()).toEqual([
			"averageHrv",
			"day",
			"readinessScore",
			"restingHr",
			"sleepScore",
			"sleepSec",
		]);
	});
});
