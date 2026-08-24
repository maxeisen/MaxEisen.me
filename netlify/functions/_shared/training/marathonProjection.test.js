import { describe, it, expect } from "vitest";
import { addDays, mondayOf } from "./dates.js";
import { weeklySummaries, fitnessSeries } from "./fitness.js";
import { dailyLoads } from "./load.js";
import { predictFromEffort } from "./predict.js";
import { projectMarathon, readinessPenalty } from "./marathonProjection.js";
import { MARATHON_M } from "./marathonConfig.js";
import { collectBestEfforts } from "./shape.js";

const TODAY = "2026-08-24";
const RACE = {
	name: "Chicago Marathon",
	date: "2026-10-11",
	goalTimeSec: 13200,
	distanceM: MARATHON_M,
};

function run({
	date,
	distanceKm,
	movingMin,
	decouplingPct = 3,
	paceSecPerKm = 330,
	sport = "run",
	bestEfforts = [],
	load = 55,
}) {
	const distanceM = distanceKm * 1000;
	return {
		id: `${date}-${distanceKm}-${sport}`,
		sport,
		startDateLocal: `${date}T07:00:00`,
		distanceM,
		movingTimeSec: (movingMin ?? distanceKm * 5.5) * 60,
		paceSecPerKm,
		gapPaceSecPerKm: paceSecPerKm,
		decouplingPct,
		load,
		bestEfforts,
	};
}

function block({ weeks = 8, longKm = [28, 26, 24, 22], kmPerWeek = 70, today = TODAY } = {}) {
	const runs = [];
	for (let w = 0; w < weeks; w++) {
		const start = mondayOf(addDays(today, -w * 7));
		const long = longKm[Math.min(w, longKm.length - 1)];
		const remaining = Math.max(0, kmPerWeek - long);
		runs.push(
			run({
				date: addDays(start, 6),
				distanceKm: long,
				movingMin: long * 6,
				decouplingPct: 3,
			}),
		);
		const easyDays = 4;
		const easyKm = remaining / easyDays;
		for (let d = 0; d < easyDays; d++) {
			runs.push(
				run({
					date: addDays(start, d),
					distanceKm: easyKm,
					movingMin: easyKm * 5.5,
					decouplingPct: null,
				}),
			);
		}
	}
	runs[0].bestEfforts = [
		{ name: "10k", distanceM: 10000, timeSec: 2460, date: addDays(today, -10) },
	];
	return runs;
}

function weeksOf(runs, today = TODAY) {
	const from = addDays(today, -80);
	return weeklySummaries(
		runs.filter((activity) => activity.sport !== "ride"),
		{ from, to: today },
	).map((week) => ({
		...week,
		actualKm: week.distanceM / 1000,
		targetKm: 70,
		volumePct: (week.distanceM / 1000 / 70) * 100,
		isTaper: false,
		isPlanned: true,
	}));
}

function seriesOf(runs, today = TODAY) {
	return fitnessSeries(dailyLoads(runs.filter((activity) => activity.sport !== "ride")), {
		from: addDays(today, -80),
		to: today,
	});
}

function project(runs, extra = {}) {
	const today = extra.today || TODAY;
	return projectMarathon({
		efforts: runs.flatMap((r) => r.bestEfforts || []),
		runs,
		weeks: weeksOf(runs, today),
		series: seriesOf(runs, today),
		acwr: { ratio: 1.1 },
		intensity: { easyPct: 80, moderatePct: 12, hardPct: 8 },
		recovery: {
			sleep: { recent: 7.4 * 3600, baseline: 7.4 * 3600, deltaPct: 0 },
			restingHr: { recent: 47, baseline: 47, delta: 0 },
			hrv: { recent: 68, baseline: 68, deltaPct: 0 },
			series: [],
		},
		today,
		race: RACE,
		daysToRace: 48,
		...extra,
	});
}

describe("readinessPenalty", () => {
	it("is 1 at full readiness and greater than 1 otherwise", () => {
		expect(readinessPenalty(1)).toBe(1);
		expect(readinessPenalty(0.8)).toBeGreaterThan(1);
		expect(readinessPenalty(0.3)).toBeGreaterThan(readinessPenalty(0.8));
		expect(readinessPenalty(0)).toBeGreaterThan(readinessPenalty(0.3));
	});
});

describe("projectMarathon", () => {
	it("keeps Riegel and VDOT as the aerobic baseline and never projects faster", () => {
		const out = project(block());
		expect(out.aerobicPotentialSeconds).toBeGreaterThan(0);
		expect(out.riegelSec).toBeGreaterThan(0);
		expect(out.vdotSec).toBeGreaterThan(0);
		expect(out.predictedSec).toBeGreaterThanOrEqual(out.aerobicPotentialSeconds - 1e-6);
		expect(out.readinessPenalty).toBeGreaterThanOrEqual(1);
	});

	it("returns a debug breakdown of every factor", () => {
		const out = project(block());
		expect(out.factors).toEqual(
			expect.objectContaining({
				volume: expect.any(Number),
				longRuns: expect.any(Number),
				decoupling: expect.any(Number),
				consistency: expect.any(Number),
				frequency: expect.any(Number),
				fitnessTrend: expect.any(Number),
				recovery: expect.any(Number),
			}),
		);
		expect(out.marathonReadiness).toBeGreaterThan(0);
		expect(out.marathonReadiness).toBeLessThanOrEqual(1);
		expect(out.projectionRange.fastSec).toBeLessThan(out.predictedSec);
		expect(out.projectionRange.slowSec).toBeGreaterThan(out.predictedSec);
		expect(["Low", "Moderate", "High"]).toContain(out.confidenceLabel);
	});

	it("explains the gap with deterministic factors from the metrics", () => {
		const out = project(block({ longKm: [22, 20, 18, 16], kmPerWeek: 45 }));
		expect(out.explanations.length).toBeGreaterThan(0);
		expect(out.explanations.length).toBeLessThanOrEqual(4);
		for (const factor of out.explanations) {
			expect(["positive", "limiting"]).toContain(factor.direction);
			expect(factor.text.length).toBeGreaterThan(10);
			expect(factor.key).toBeTruthy();
		}
	});

	it("weights a recent half marathon above a faster 5k when they disagree", () => {
		const half = { name: "Half", distanceM: 21097.5, timeSec: 6300, date: addDays(TODAY, -14) };
		const fiveK = { name: "5k", distanceM: 5000, timeSec: 1080, date: addDays(TODAY, -7) };
		const runs = block();
		runs[0].bestEfforts = [half, fiveK];
		const out = project(runs);
		const halfOnly = predictFromEffort(half, MARATHON_M).predictedSec;
		const fiveOnly = predictFromEffort(fiveK, MARATHON_M).predictedSec;
		expect(fiveOnly).toBeLessThan(halfOnly);
		const towardHalf = Math.abs(out.aerobicPotentialSeconds - halfOnly);
		const towardFive = Math.abs(out.aerobicPotentialSeconds - fiveOnly);
		expect(towardHalf).toBeLessThan(towardFive);
	});

	it("does not let a long-run half split set aerobic potential", () => {
		const runs = block();
		for (const activity of runs) activity.bestEfforts = [];
		const long = runs.reduce((best, activity) =>
			activity.distanceM > best.distanceM ? activity : best,
		);
		long.distanceM = 23000;
		long.workoutType = 2;
		long.bestEfforts = [
			{ name: "Half-Marathon", distanceM: 21097, timeSec: 6563, date: addDays(TODAY, -1) },
		];
		const workout = run({ date: addDays(TODAY, -20), distanceKm: 8, movingMin: 40 });
		workout.workoutType = 3;
		workout.bestEfforts = [{ name: "5k", distanceM: 5000, timeSec: 1240, date: addDays(TODAY, -20) }];
		const all = [...runs, workout];
		const out = project(all, { efforts: collectBestEfforts(all) });
		const fiveOnly = predictFromEffort(workout.bestEfforts[0], MARATHON_M).predictedSec;
		const halfOnly = predictFromEffort(long.bestEfforts[0], MARATHON_M).predictedSec;
		expect(out.aerobicPotentialSeconds).toBeCloseTo(fiveOnly, 0);
		expect(Math.abs(out.aerobicPotentialSeconds - fiveOnly)).toBeLessThan(
			Math.abs(out.aerobicPotentialSeconds - halfOnly),
		);
		expect(out.basis.distanceM).toBe(5000);
	});

	it("does not claim high confidence from a 10k and short long runs alone", () => {
		const out = project(block({ longKm: [22, 20, 18, 16], kmPerWeek: 50 }));
		expect(out.basis.distanceM).toBe(10000);
		expect(out.confidenceLabel).not.toBe("High");
	});

	it("does not let training data make the projection faster than aerobic potential", () => {
		const stacked = block({ weeks: 10, longKm: [34, 32, 30, 28], kmPerWeek: 100 });
		const out = project(stacked);
		expect(out.predictedSec).toBeGreaterThanOrEqual(out.aerobicPotentialSeconds - 1e-6);
	});
});

describe("monotonic marathon projection", () => {
	it("never projects a slower time when sustained mileage rises, all else equal", () => {
		const light = project(block({ kmPerWeek: 50, longKm: [24, 22, 20, 18] }));
		const heavy = project(block({ kmPerWeek: 85, longKm: [24, 22, 20, 18] }));
		expect(heavy.predictedSec).toBeLessThanOrEqual(light.predictedSec + 1);
		expect(heavy.marathonReadiness).toBeGreaterThanOrEqual(light.marathonReadiness);
	});

	it("never reduces readiness when another healthy 30 km long run is added", () => {
		const baseRuns = block({ longKm: [26, 24, 22, 20] });
		const withLong = [
			...baseRuns,
			run({
				date: addDays(TODAY, -2),
				distanceKm: 30,
				movingMin: 180,
				decouplingPct: 2,
				paceSecPerKm: 325,
			}),
		];
		expect(project(withLong).marathonReadiness).toBeGreaterThanOrEqual(
			project(baseRuns).marathonReadiness,
		);
	});

	it("does not improve readiness when decoupling gets worse", () => {
		const stable = project(block({ longKm: [30, 28, 26, 24] }));
		const drifted = project(
			block({ longKm: [30, 28, 26, 24] }).map((r) =>
				r.distanceM >= 20000 ? { ...r, decouplingPct: 9 } : r,
			),
		);
		expect(drifted.marathonReadiness).toBeLessThanOrEqual(stable.marathonReadiness + 1e-6);
	});

	it("does not improve readiness after a zero-running week", () => {
		const steady = project(block({ weeks: 9 }));
		const gappedRuns = block({ weeks: 9 }).filter((r) => {
			const start = mondayOf(addDays(TODAY, -14));
			return r.startDateLocal.slice(0, 10) < start || r.startDateLocal.slice(0, 10) > addDays(start, 6);
		});
		expect(project(gappedRuns).marathonReadiness).toBeLessThanOrEqual(steady.marathonReadiness + 1e-6);
	});

	it("does not let cycling satisfy running-mileage requirements", () => {
		const running = project(block({ kmPerWeek: 50 }));
		const padded = project([
			...block({ kmPerWeek: 50 }),
			run({ date: addDays(TODAY, -3), distanceKm: 80, sport: "ride", load: 120 }),
		]);
		expect(padded.marathonReadiness).toBeCloseTo(running.marathonReadiness, 5);
		expect(padded.predictedSec).toBeCloseTo(running.predictedSec, 3);
	});

	it("raises demonstrated readiness when a planned long run is completed", () => {
		const before = block({ longKm: [24, 22, 20, 18] });
		const after = [
			...before,
			run({
				date: TODAY,
				distanceKm: 30,
				movingMin: 180,
				decouplingPct: 2.5,
				paceSecPerKm: 328,
			}),
		];
		expect(project(after).marathonReadiness).toBeGreaterThan(project(before).marathonReadiness);
	});

	it("does not erase aerobic potential when training fatigue is very high", () => {
		const runs = block({ kmPerWeek: 80, longKm: [30, 28, 26, 24] });
		const out = project(runs, {
			series: seriesOf(runs).map((d) =>
				d.date === TODAY ? { ...d, atl: d.ctl + 40, tsb: -40 } : d,
			),
		});
		expect(out.predictedSec).toBeLessThan(out.aerobicPotentialSeconds * 1.12);
		expect(out.aerobicPotentialSeconds).toBeGreaterThan(0);
	});

	it("does not read a taper mileage cut as lost marathon readiness", () => {
		const built = block({ weeks: 8, kmPerWeek: 80, longKm: [32, 30, 28, 26] });
		const taperedWeeks = weeksOf(built).map((week) => {
			if (week.start >= mondayOf(addDays(TODAY, -7))) {
				return {
					...week,
					distanceM: 35000,
					actualKm: 35,
					volumePct: 50,
					isTaper: true,
				};
			}
			return week;
		});
		const peaked = project(built);
		const tapering = project(built, { weeks: taperedWeeks, daysToRace: 14 });
		expect(tapering.marathonReadiness).toBeGreaterThanOrEqual(peaked.marathonReadiness - 0.02);
	});
});
