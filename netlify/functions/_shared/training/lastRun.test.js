import { describe, it, expect } from "vitest";
import { lastRunDetail } from "./lastRun.js";
import { fitnessSeries } from "./fitness.js";
import { dailyLoads } from "./load.js";

const THRESHOLDS = {
	maxHr: 195,
	restingHr: 47,
	lactateThresholdHr: 172,
	thresholdPaceSecPerKm: 255,
	marathonPaceSecPerKm: 285,
};

/** A shaped-activity-shaped object, with only the fields under test set. */
function run(date, overrides = {}) {
	const distanceM = overrides.distanceM ?? 10000;
	const movingTimeSec = overrides.movingTimeSec ?? 3000;
	return {
		id: Number(date.replaceAll("-", "")),
		name: "Morning Run",
		type: "Run",
		startDateLocal: `${date}T07:00:00Z`,
		distanceM,
		movingTimeSec,
		elapsedTimeSec: movingTimeSec + 60,
		elevationGainM: 40,
		averageHr: 145,
		maxHr: 168,
		averageCadence: 86,
		paceSecPerKm: movingTimeSec / (distanceM / 1000),
		gapPaceSecPerKm: movingTimeSec / (distanceM / 1000),
		load: 50,
		loadMethod: "hr",
		zoneSeconds: null,
		decouplingPct: null,
		splits: [],
		...overrides,
	};
}

/** Even kilometres at a given pace, with the last one optionally short. */
function splits(paces, { lastDistanceM = 1000 } = {}) {
	return paces.map((paceSecPerKm, i) => {
		const distanceM = i === paces.length - 1 ? lastDistanceM : 1000;
		return {
			km: i + 1,
			distanceM,
			timeSec: paceSecPerKm * (distanceM / 1000),
			elevationM: 0,
			paceSecPerKm,
			gapPaceSecPerKm: paceSecPerKm,
			averageHr: 150,
		};
	});
}

function seriesFor(runs, { from, to }) {
	return fitnessSeries(dailyLoads(runs), { from, to });
}

describe("lastRunDetail", () => {
	it("has nothing to report before anything has been run", () => {
		expect(lastRunDetail({ runs: [], today: "2026-08-11" })).toBeNull();
	});

	it("reports the newest run, however the list arrived", () => {
		const runs = [run("2026-08-03"), run("2026-08-09", { name: "Sunday Long Run" })];
		const detail = lastRunDetail({ runs, today: "2026-08-11" });

		expect(detail.name).toBe("Sunday Long Run");
		expect(detail.date).toBe("2026-08-09");
		expect(detail.daysAgo).toBe(2);
	});

	it("carries the measurements the log leaves behind", () => {
		const detail = lastRunDetail({
			runs: [run("2026-08-09", { decouplingPct: 3.4, zoneSeconds: [600, 1800, 300, 0, 0] })],
			today: "2026-08-09",
		});

		expect(detail.maxHr).toBe(168);
		expect(detail.averageCadence).toBe(86);
		expect(detail.decouplingPct).toBe(3.4);
		expect(detail.load).toBe(50);
	});

	// The privacy boundary, restated at the point it would be crossed: this is
	// the one place per-kilometre data is served at all.
	it("serves splits without the hill profile behind them", () => {
		const detail = lastRunDetail({
			runs: [run("2026-08-09", { splits: splits([300, 305, 298, 310]) })],
			today: "2026-08-09",
		});

		expect(detail.splits).toHaveLength(4);
		expect(detail.splits[0]).toEqual({
			km: 1,
			paceSecPerKm: 300,
			gapPaceSecPerKm: 300,
			averageHr: 150,
		});
		for (const split of detail.splits) {
			expect(split).not.toHaveProperty("elevationM");
			expect(split).not.toHaveProperty("distanceM");
		}
	});

	describe("what it did to fitness, fatigue and form", () => {
		const range = { from: "2026-07-01", to: "2026-08-09" };

		it("brackets the run: fatigue jumps, fitness inches up, form drops", () => {
			const runs = [run("2026-08-02"), run("2026-08-09", { load: 120 })];
			const detail = lastRunDetail({
				runs,
				series: seriesFor(runs, range),
				today: "2026-08-09",
			});

			const { form } = detail.impact;
			expect(form.dayLoad).toBe(120);
			expect(form.atlDelta).toBeGreaterThan(form.ctlDelta);
			expect(form.ctlDelta).toBeGreaterThan(0);
			// Fatigue rising faster than fitness is what leaves you flat.
			expect(form.tsbDelta).toBeLessThan(0);
			expect(form.tsb).toBeCloseTo(form.ctl - form.atl, 10);
		});

		it("has no before to compare against on the block's first day", () => {
			const runs = [run("2026-07-01")];
			const detail = lastRunDetail({
				runs,
				series: seriesFor(runs, { from: "2026-07-01", to: "2026-07-01" }),
				today: "2026-07-01",
			});

			expect(detail.impact.form).toBeNull();
		});

		it("counts the runs sharing the day, since the change belongs to both", () => {
			const runs = [run("2026-08-09"), run("2026-08-09", { id: 2, name: "Evening Shakeout" })];
			const detail = lastRunDetail({ runs, today: "2026-08-09" });

			expect(detail.runsThatDay).toBe(2);
		});
	});

	describe("how it compares with the runs around it", () => {
		it("measures the load against the median of the last six weeks", () => {
			const runs = [
				run("2026-07-20", { load: 40 }),
				run("2026-07-27", { load: 60 }),
				run("2026-08-03", { load: 50 }),
				run("2026-08-09", { load: 100 }),
			];
			const { load } = lastRunDetail({ runs, today: "2026-08-09" }).impact;

			expect(load.typicalLoad).toBe(50);
			expect(load.vsTypicalPct).toBe(200);
			expect(load.runsCompared).toBe(3);
		});

		it("ignores runs from further back than the window", () => {
			const runs = [run("2026-05-01", { load: 400 }), run("2026-08-09", { load: 100 })];
			const { load } = lastRunDetail({ runs, today: "2026-08-09" }).impact;

			expect(load.runsCompared).toBe(0);
			expect(load.typicalLoad).toBeNull();
			expect(load.vsTypicalPct).toBeNull();
		});

		it("says how long since a run cost as much", () => {
			const runs = [
				run("2026-07-26", { load: 130 }),
				run("2026-08-02", { load: 60 }),
				run("2026-08-09", { load: 120 }),
			];
			const { load } = lastRunDetail({ runs, today: "2026-08-09" }).impact;

			expect(load.daysSinceAsHard).toBe(14);
		});

		it("reports nothing to match when it's the hardest of the block", () => {
			const runs = [run("2026-08-02", { load: 60 }), run("2026-08-09", { load: 200 })];
			const { load } = lastRunDetail({ runs, today: "2026-08-09" }).impact;

			expect(load.daysSinceAsHard).toBeNull();
		});
	});

	describe("what it was worth to the week", () => {
		const weeks = [
			{ start: "2026-08-03", actualKm: 48, targetKm: 60 },
			{ start: "2026-08-10", actualKm: 12, targetKm: 55 },
		];

		it("places the run in its week and takes its share of the target", () => {
			const runs = [run("2026-08-09", { distanceM: 24000 })];
			const { week } = lastRunDetail({ runs, weeks, today: "2026-08-11" }).impact;

			expect(week.start).toBe("2026-08-03");
			expect(week.targetKm).toBe(60);
			expect(week.sharePct).toBe(40);
		});

		it("has no share to quote for a week the plan doesn't cover", () => {
			const runs = [run("2026-08-09", { distanceM: 24000 })];
			const unplanned = [{ start: "2026-08-03", actualKm: 48, targetKm: null }];
			const { week } = lastRunDetail({ runs, weeks: unplanned, today: "2026-08-11" }).impact;

			expect(week.sharePct).toBeNull();
			expect(week.actualKm).toBe(48);
		});

		it("says nothing at all about a run outside every known week", () => {
			const runs = [run("2026-09-30")];
			const { week } = lastRunDetail({ runs, weeks, today: "2026-09-30" }).impact;

			expect(week).toBeNull();
		});
	});

	describe("how it was paced", () => {
		it("compares the halves and names the edges", () => {
			const runs = [run("2026-08-09", { splits: splits([300, 300, 320, 320]) })];
			const { pacing } = lastRunDetail({ runs, today: "2026-08-09" });

			expect(pacing.firstHalfPaceSecPerKm).toBe(300);
			expect(pacing.secondHalfPaceSecPerKm).toBe(320);
			expect(pacing.fadePct).toBeCloseTo(6.67, 2);
			expect(pacing.fastest.km).toBe(1);
			expect(pacing.slowest.km).toBe(4);
		});

		it("calls a negative split negative", () => {
			const runs = [run("2026-08-09", { splits: splits([320, 320, 300, 300]) })];
			const { pacing } = lastRunDetail({ runs, today: "2026-08-09" });

			expect(pacing.fadePct).toBeLessThan(0);
		});

		it("won't let a 200 m finish be the fastest kilometre", () => {
			const runs = [
				run("2026-08-09", { splits: splits([300, 305, 298, 200], { lastDistanceM: 200 }) }),
			];
			const { pacing } = lastRunDetail({ runs, today: "2026-08-09" });

			expect(pacing.fastest.km).toBe(3);
		});

		it("keeps quiet about a run too short to have halves", () => {
			const runs = [run("2026-08-09", { splits: splits([300, 305]) })];
			expect(lastRunDetail({ runs, today: "2026-08-09" }).pacing).toBeNull();
		});
	});

	describe("how hard it was", () => {
		it("reads the effort off the zones when there's a heart rate", () => {
			const easy = run("2026-08-09", { zoneSeconds: [1200, 1500, 200, 0, 0] });
			const workout = run("2026-08-09", { zoneSeconds: [600, 600, 300, 900, 300] });

			expect(lastRunDetail({ runs: [easy], today: "2026-08-09" }).effort).toBe("easy");
			expect(lastRunDetail({ runs: [workout], today: "2026-08-09" }).effort).toBe("hard");
		});

		it("rolls the zones up the way the intensity panel does", () => {
			const runs = [run("2026-08-09", { zoneSeconds: [1000, 1000, 500, 400, 100] })];
			const { zoneMix } = lastRunDetail({ runs, today: "2026-08-09" });

			expect(zoneMix.totalSec).toBe(3000);
			expect(zoneMix.easyPct).toBeCloseTo(66.67, 2);
			expect(zoneMix.moderatePct).toBeCloseTo(16.67, 2);
			expect(zoneMix.hardPct).toBeCloseTo(16.67, 2);
		});

		it("falls back to grade-adjusted pace for a run with no strap", () => {
			const runs = [run("2026-08-09", { averageHr: null, gapPaceSecPerKm: 240 })];
			const detail = lastRunDetail({ runs, thresholds: THRESHOLDS, today: "2026-08-09" });

			expect(detail.zoneMix).toBeNull();
			expect(detail.effort).toBe("hard");
		});
	});

	it("carries the plan match it was handed", () => {
		const planMatch = { planned: true, type: "long run", detail: "24 km easy", distanceKm: 24 };
		const detail = lastRunDetail({ runs: [run("2026-08-09")], planMatch, today: "2026-08-09" });

		expect(detail.plan).toEqual(planMatch);
	});
});
