import { describe, it, expect } from "vitest";
import { addDays, mondayOf } from "./dates.js";
import { weeklySummaries } from "./fitness.js";
import {
	clamp01,
	combineReadiness,
	lerpScore,
	recencyWeight,
	scoreConsistency,
	scoreDecoupling,
	scoreFitnessTrend,
	scoreFrequency,
	scoreLongRuns,
	scoreRecovery,
	scoreVolume,
} from "./marathonReadiness.js";
import { MARATHON_PROJECTION } from "./marathonConfig.js";

const TODAY = "2026-08-24";

function run({ date, distanceKm, movingMin, decouplingPct, paceSecPerKm, sport = "run" }) {
	const distanceM = distanceKm * 1000;
	const movingTimeSec = (movingMin ?? distanceKm * 6) * 60;
	return {
		sport,
		startDateLocal: `${date}T07:00:00`,
		distanceM,
		movingTimeSec,
		paceSecPerKm: paceSecPerKm ?? 330,
		gapPaceSecPerKm: paceSecPerKm ?? 330,
		decouplingPct: decouplingPct ?? null,
		load: 50,
	};
}

function weeksFrom(runs, from = "2026-06-15", to = TODAY) {
	return weeklySummaries(
		runs.filter((activity) => activity.sport !== "ride"),
		{ from, to },
	).map((week) => ({
		...week,
		actualKm: week.distanceM / 1000,
		targetKm: 70,
		volumePct: (week.distanceM / 1000 / 70) * 100,
		isTaper: false,
		isPlanned: true,
	}));
}

describe("lerpScore", () => {
	it("is 0 at the floor and 1 at the full mark", () => {
		expect(lerpScore(40, 40, 85)).toBe(0);
		expect(lerpScore(85, 40, 85)).toBe(1);
	});

	it("moves smoothly between the ends and stays in 0–1", () => {
		expect(lerpScore(62.5, 40, 85)).toBeCloseTo(0.5, 5);
		expect(lerpScore(10, 40, 85)).toBe(0);
		expect(lerpScore(200, 40, 85)).toBe(1);
	});
});

describe("recencyWeight", () => {
	it("is 1 today and halves after one half-life", () => {
		expect(recencyWeight(TODAY, TODAY, 21)).toBeCloseTo(1, 5);
		expect(recencyWeight(addDays(TODAY, -21), TODAY, 21)).toBeCloseTo(0.5, 5);
	});
});

describe("scoreVolume", () => {
	it("scores higher sustained mileage better", () => {
		const light = weeksFrom(
			Array.from({ length: 24 }, (_, i) =>
				run({ date: addDays(TODAY, -(i * 2 + 1)), distanceKm: 8 }),
			),
		);
		const heavy = weeksFrom(
			Array.from({ length: 40 }, (_, i) =>
				run({ date: addDays(TODAY, -(i * 1.5 + 1)), distanceKm: 14 }),
			),
		);
		expect(scoreVolume({ weeks: heavy, today: TODAY }).score).toBeGreaterThan(
			scoreVolume({ weeks: light, today: TODAY }).score,
		);
	});

	it("does not treat ~30 km weeks as zero volume when that is the plan", () => {
		const planned = weeksFrom(
			Array.from({ length: 32 }, (_, i) =>
				run({ date: addDays(TODAY, -(i * 2 + 1)), distanceKm: 10 }),
			),
		).map((week) => ({ ...week, targetKm: 35, volumePct: (week.distanceM / 1000 / 35) * 100 }));
		const out = scoreVolume({ weeks: planned, today: TODAY });
		expect(out.score).toBeGreaterThan(0.25);
		expect(out.metrics.ewma8).toBeGreaterThan(20);
		expect(out.metrics.ewma8).toBeLessThan(45);
	});

	it("does not count cycling kilometres as running volume", () => {
		const runs = Array.from({ length: 20 }, (_, i) =>
			run({ date: addDays(TODAY, -(i * 2 + 1)), distanceKm: 10 }),
		);
		const withRides = [
			...runs,
			run({ date: addDays(TODAY, -3), distanceKm: 80, sport: "ride" }),
		];
		expect(scoreVolume({ weeks: weeksFrom(withRides), today: TODAY }).score).toBeCloseTo(
			scoreVolume({ weeks: weeksFrom(runs), today: TODAY }).score,
			5,
		);
	});

	it("does not treat a taper week as a loss of volume", () => {
		const build = weeksFrom(
			Array.from({ length: 32 }, (_, i) =>
				run({ date: addDays(TODAY, -(i * 2 + 8)), distanceKm: 12 }),
			),
		);
		const tapered = build.map((week) => {
			if (week.start >= mondayOf(addDays(TODAY, -7))) {
				return { ...week, distanceM: 25000, actualKm: 25, isTaper: true, volumePct: 50 };
			}
			return week;
		});
		expect(scoreVolume({ weeks: tapered, today: TODAY }).score).toBeGreaterThanOrEqual(
			scoreVolume({ weeks: build, today: TODAY }).score - 0.001,
		);
	});
});

describe("scoreLongRuns", () => {
	it("credits a cluster of long runs more than one heroic outing", () => {
		const clustered = [
			run({ date: addDays(TODAY, -7), distanceKm: 34 }),
			run({ date: addDays(TODAY, -14), distanceKm: 30 }),
			run({ date: addDays(TODAY, -21), distanceKm: 28 }),
			run({ date: addDays(TODAY, -28), distanceKm: 24 }),
		];
		const heroic = [
			run({ date: addDays(TODAY, -7), distanceKm: 34 }),
			run({ date: addDays(TODAY, -14), distanceKm: 20 }),
			run({ date: addDays(TODAY, -21), distanceKm: 18 }),
			run({ date: addDays(TODAY, -28), distanceKm: 16 }),
		];
		expect(scoreLongRuns({ runs: clustered, today: TODAY }).score).toBeGreaterThan(
			scoreLongRuns({ runs: heroic, today: TODAY }).score + 0.08,
		);
	});

	it("does not treat cycling as a long run", () => {
		const runs = [run({ date: addDays(TODAY, -7), distanceKm: 18 })];
		const withRide = [...runs, run({ date: addDays(TODAY, -6), distanceKm: 40, sport: "ride" })];
		expect(scoreLongRuns({ runs: withRide, today: TODAY }).metrics.longestM).toBe(
			scoreLongRuns({ runs: runs, today: TODAY }).metrics.longestM,
		);
	});

	it("gives a modest boost for a long run near marathon pace, not a race", () => {
		const easy = [
			run({ date: addDays(TODAY, -7), distanceKm: 28, paceSecPerKm: 360 }),
			run({ date: addDays(TODAY, -14), distanceKm: 26, paceSecPerKm: 360 }),
		];
		const nearMp = [
			run({ date: addDays(TODAY, -7), distanceKm: 28, paceSecPerKm: 318, decouplingPct: 2 }),
			run({ date: addDays(TODAY, -14), distanceKm: 26, paceSecPerKm: 320, decouplingPct: 2 }),
		];
		const raced = [
			run({ date: addDays(TODAY, -7), distanceKm: 28, paceSecPerKm: 280, decouplingPct: 7 }),
			run({ date: addDays(TODAY, -14), distanceKm: 26, paceSecPerKm: 282, decouplingPct: 7 }),
		];
		const predictedPace = 313;
		expect(
			scoreLongRuns({ runs: nearMp, today: TODAY, predictedPaceSecPerKm: predictedPace }).score,
		).toBeGreaterThan(
			scoreLongRuns({ runs: easy, today: TODAY, predictedPaceSecPerKm: predictedPace }).score,
		);
		expect(
			scoreLongRuns({ runs: raced, today: TODAY, predictedPaceSecPerKm: predictedPace }).score,
		).toBeLessThanOrEqual(
			scoreLongRuns({ runs: nearMp, today: TODAY, predictedPaceSecPerKm: predictedPace }).score,
		);
	});
});

describe("scoreDecoupling", () => {
	it("treats lower decoupling as better, including negative as excellent", () => {
		const long = (pct) => [
			run({ date: addDays(TODAY, -7), distanceKm: 28, movingMin: 170, decouplingPct: pct }),
			run({ date: addDays(TODAY, -14), distanceKm: 26, movingMin: 160, decouplingPct: pct }),
		];
		expect(scoreDecoupling({ runs: long(1), today: TODAY }).score).toBeGreaterThan(
			scoreDecoupling({ runs: long(6), today: TODAY }).score,
		);
		expect(scoreDecoupling({ runs: long(-2), today: TODAY }).score).toBeGreaterThanOrEqual(
			scoreDecoupling({ runs: long(0), today: TODAY }).score,
		);
		expect(scoreDecoupling({ runs: long(-2), today: TODAY }).score).toBeLessThanOrEqual(1);
	});

	it("ignores runs too short for decoupling to mean anything", () => {
		const shorts = [
			run({ date: addDays(TODAY, -7), distanceKm: 8, movingMin: 40, decouplingPct: 0 }),
			run({ date: addDays(TODAY, -8), distanceKm: 8, movingMin: 40, decouplingPct: 0 }),
		];
		expect(scoreDecoupling({ runs: shorts, today: TODAY }).available).toBe(false);
	});

	it("weights longer runs more heavily", () => {
		const longerStable = [
			run({ date: addDays(TODAY, -7), distanceKm: 32, movingMin: 200, decouplingPct: 1 }),
			run({ date: addDays(TODAY, -14), distanceKm: 18, movingMin: 80, decouplingPct: 9 }),
		];
		const shorterStable = [
			run({ date: addDays(TODAY, -7), distanceKm: 18, movingMin: 80, decouplingPct: 1 }),
			run({ date: addDays(TODAY, -14), distanceKm: 32, movingMin: 200, decouplingPct: 9 }),
		];
		expect(scoreDecoupling({ runs: longerStable, today: TODAY }).score).toBeGreaterThan(
			scoreDecoupling({ runs: shorterStable, today: TODAY }).score,
		);
	});
});

describe("scoreConsistency", () => {
	it("penalises a zero-running week", () => {
		const steadyRuns = Array.from({ length: 40 }, (_, i) =>
			run({ date: addDays(TODAY, -(i + 3)), distanceKm: 10 }),
		);
		const gapped = weeksFrom(steadyRuns).map((week) => {
			if (week.start === mondayOf(addDays(TODAY, -14))) {
				return { ...week, distanceM: 0, actualKm: 0, runs: 0, volumePct: 0, longestRunM: 0 };
			}
			return week;
		});
		expect(scoreConsistency({ weeks: gapped, today: TODAY }).score).toBeLessThan(
			scoreConsistency({ weeks: weeksFrom(steadyRuns), today: TODAY }).score,
		);
	});

	it("does not treat a zero week two months ago as a recent interruption", () => {
		const steadyRuns = Array.from({ length: 40 }, (_, i) =>
			run({ date: addDays(TODAY, -(i + 3)), distanceKm: 10 }),
		);
		const oldGap = weeksFrom(steadyRuns).map((week) => {
			if (week.start === mondayOf(addDays(TODAY, -56))) {
				return { ...week, distanceM: 0, actualKm: 0, runs: 0, volumePct: 0, longestRunM: 0 };
			}
			return week;
		});
		const steady = scoreConsistency({ weeks: weeksFrom(steadyRuns), today: TODAY }).score;
		const gapped = scoreConsistency({ weeks: oldGap, today: TODAY }).score;
		expect(gapped).toBeGreaterThan(steady - 0.12);
		expect(gapped).toBeGreaterThan(0.5);
	});

	it("ignores intentional taper reductions", () => {
		const steady = weeksFrom(
			Array.from({ length: 40 }, (_, i) =>
				run({ date: addDays(TODAY, -(i + 3)), distanceKm: 10 }),
			),
		);
		const taper = steady.map((week) =>
			week.start >= mondayOf(addDays(TODAY, -7))
				? { ...week, distanceM: 20000, actualKm: 20, volumePct: 40, isTaper: true }
				: week,
		);
		expect(scoreConsistency({ weeks: taper, today: TODAY }).score).toBeGreaterThan(
			scoreConsistency({ weeks: steady, today: TODAY }).score - 0.05,
		);
	});
});

describe("scoreFrequency", () => {
	it("scores four runs a week above three, then saturates", () => {
		const three = Array.from({ length: 18 }, (_, i) =>
			run({ date: addDays(TODAY, -1 - Math.floor(i * (7 / 3))), distanceKm: 10 }),
		);
		const five = Array.from({ length: 30 }, (_, i) =>
			run({ date: addDays(TODAY, -1 - Math.floor(i * (7 / 5))), distanceKm: 8 }),
		);
		const seven = Array.from({ length: 42 }, (_, i) =>
			run({ date: addDays(TODAY, -(i + 1)), distanceKm: 6 }),
		);
		const threeScore = scoreFrequency({ runs: three, today: TODAY }).score;
		const fiveScore = scoreFrequency({ runs: five, today: TODAY }).score;
		const sevenScore = scoreFrequency({ runs: seven, today: TODAY }).score;
		expect(fiveScore).toBeGreaterThan(threeScore);
		expect(sevenScore).toBeLessThanOrEqual(fiveScore + 0.02);
	});
});

describe("scoreFitnessTrend", () => {
	it("does not punish negative form in a normal training week", () => {
		const building = {
			series: [
				{ date: addDays(TODAY, -42), ctl: 40, atl: 38, tsb: 2 },
				{ date: addDays(TODAY, -28), ctl: 45, atl: 50, tsb: -5 },
				{ date: TODAY, ctl: 55, atl: 80, tsb: -25 },
			],
			today: TODAY,
			daysToRace: 50,
			acwr: { ratio: 1.1 },
		};
		const freshButFlat = {
			series: [
				{ date: addDays(TODAY, -42), ctl: 55, atl: 40, tsb: 15 },
				{ date: addDays(TODAY, -28), ctl: 55, atl: 40, tsb: 15 },
				{ date: TODAY, ctl: 54, atl: 40, tsb: 14 },
			],
			today: TODAY,
			daysToRace: 50,
			acwr: { ratio: 1.0 },
		};
		expect(scoreFitnessTrend(building).score).toBeGreaterThan(scoreFitnessTrend(freshButFlat).score);
	});
});

describe("scoreRecovery", () => {
	it("scores against the athlete's own baseline, not population cutoffs", () => {
		const good = {
			sleep: { recent: 7.5 * 3600, baseline: 7.4 * 3600, deltaPct: 1 },
			restingHr: { recent: 47, baseline: 47, delta: 0 },
			hrv: { recent: 70, baseline: 68, deltaPct: 3 },
			series: [],
		};
		const poor = {
			sleep: { recent: 6 * 3600, baseline: 7.4 * 3600, deltaPct: -19 },
			restingHr: { recent: 54, baseline: 47, delta: 7 },
			hrv: { recent: 50, baseline: 68, deltaPct: -26 },
			series: [],
		};
		expect(scoreRecovery({ recovery: good, today: TODAY }).score).toBeGreaterThan(
			scoreRecovery({ recovery: poor, today: TODAY }).score,
		);
	});

	it("is unavailable rather than invented when there is no ring data", () => {
		expect(scoreRecovery({ recovery: null, today: TODAY }).available).toBe(false);
	});
});

describe("combineReadiness", () => {
	it("weights the configured factors and stays in 0–1", () => {
		const out = combineReadiness({
			volume: { score: 1 },
			longRuns: { score: 1 },
			decoupling: { score: 1, available: true },
			consistency: { score: 1 },
			frequency: { score: 1 },
			fitnessTrend: { score: 1 },
			recovery: { score: 1, available: true },
		});
		expect(out.marathonReadiness).toBeCloseTo(1, 5);
		expect(clamp01(out.marathonReadiness)).toBe(out.marathonReadiness);
	});

	it("redistributes weight when a factor is unavailable", () => {
		const withDecoupling = combineReadiness({
			volume: { score: 0.8 },
			longRuns: { score: 0.8 },
			decoupling: { score: 0.2, available: true },
			consistency: { score: 0.8 },
			frequency: { score: 0.8 },
			fitnessTrend: { score: 0.8 },
			recovery: { score: 0.8, available: false },
		});
		const withoutDecoupling = combineReadiness({
			volume: { score: 0.8 },
			longRuns: { score: 0.8 },
			decoupling: { score: 0.2, available: false },
			consistency: { score: 0.8 },
			frequency: { score: 0.8 },
			fitnessTrend: { score: 0.8 },
			recovery: { score: 0.8, available: false },
		});
		expect(withoutDecoupling.marathonReadiness).toBeGreaterThan(withDecoupling.marathonReadiness);
	});

	it("keeps configured weights summing to 1", () => {
		const total = Object.values(MARATHON_PROJECTION.weights).reduce((sum, n) => sum + n, 0);
		expect(total).toBeCloseTo(1, 10);
	});
});
