import { describe, it, expect } from "vitest";
import { buildDashboard } from "./metrics.js";
import { shapeActivities } from "./shape.js";
import { addDays } from "./dates.js";

const PLAN = {
	race: { name: "Chicago Marathon", date: "2026-10-11", goalTimeSec: 13200, distanceM: 42195 },
	thresholds: { maxHr: 195, restingHr: 47, thresholdPaceSecPerKm: 288, marathonPaceSecPerKm: 313 },
	weeks: [
		{ start: "2026-08-10", targetKm: 65, longRunKm: 30, key: [{ type: "tempo", detail: "3x10min" }] },
		{ start: "2026-08-17", targetKm: 70, longRunKm: 32, key: [] },
	],
};

// A block of easy runs ending on `lastDay`, one every other day.
function block(lastDay, count, { distanceM = 12000, hr = 140 } = {}) {
	return Array.from({ length: count }, (_, i) => ({
		id: 1000 + i,
		name: `Run ${i}`,
		type: "Run",
		startDateLocal: `${addDays(lastDay, -(count - 1 - i) * 2)}T07:00:00`,
		distanceM,
		movingTimeSec: (distanceM / 1000) * 330,
		elapsedTimeSec: (distanceM / 1000) * 335,
		elevationGainM: 40,
		averageHr: hr,
		paceSecPerKm: 330,
		gapPaceSecPerKm: 330,
		splits: [],
		bestEfforts: [],
		load: 45,
	}));
}

describe("buildDashboard", () => {
	it("survives having no activities at all", () => {
		const out = buildDashboard({ activities: [], plan: PLAN, today: "2026-08-11" });
		expect(out.summary.totals.runs).toBe(0);
		expect(out.runs).toEqual([]);
		expect(Array.isArray(out.recommendations)).toBe(true);
	});

	it("counts down to race day", () => {
		const out = buildDashboard({ activities: [], plan: PLAN, today: "2026-08-11" });
		expect(out.summary.daysToRace).toBe(61);
		expect(out.summary.race.name).toBe("Chicago Marathon");
		expect(out.summary.race.goalPaceSecPerKm).toBeCloseTo(312.8, 1);
	});

	it("totals distance and time across the block", () => {
		const out = buildDashboard({
			activities: block("2026-08-11", 10),
			plan: PLAN,
			today: "2026-08-11",
		});
		expect(out.summary.totals.runs).toBe(10);
		expect(out.summary.totals.distanceM).toBe(120000);
	});

	it("lays the current week out day by day against its sessions", () => {
		// Tuesday of a week planning an easy run Tuesday and a long run Sunday,
		// with the Tuesday run already done.
		const planned = {
			...PLAN,
			weeks: [
				{
					start: "2026-08-10",
					sessions: [
						{ day: "Monday", type: "rest", detail: "Rest" },
						{ day: "Tuesday", type: "easy run", distanceKm: 8, detail: "8km Easy Run" },
						{ day: "Wednesday", type: "strength", detail: "25m Legs & Core" },
						{ day: "Sunday", type: "long run", distanceKm: 24, detail: "24km Long Run" },
					],
				},
			],
		};
		const out = buildDashboard({
			activities: block("2026-08-11", 1, { distanceM: 8000 }),
			plan: planned,
			today: "2026-08-11",
		});

		const days = out.week.days;
		expect(days).toHaveLength(7);
		expect(days[0].date).toBe("2026-08-10");

		const tuesday = days[1];
		expect(tuesday.isToday).toBe(true);
		expect(tuesday.planned[0].type).toBe("easy run");
		expect(tuesday.actualKm).toBe(8);

		// Sunday's long run hasn't happened yet, and isn't in the past — the UI
		// leans on this to avoid calling an unrun future session missed.
		const sunday = days[6];
		expect(sunday.planned[0].distanceKm).toBe(24);
		expect(sunday.actualKm).toBe(0);
		expect(sunday.isPast).toBe(false);

		// Non-running days still appear, so the week reads as a whole.
		expect(days[2].planned[0].type).toBe("strength");
		expect(days[2].planned[0].isRun).toBe(false);

		// Nothing planned for Thursday at all.
		expect(days[3].planned).toEqual([]);
	});

	it("reports the long run as Sunday's session, not as Tuesday's progress", () => {
		// The week's only run so far is Tuesday's 8 km. None of it is part of
		// Sunday's 24, though reading the week's longest run as the long run
		// used to say it was a third done.
		const planned = {
			...PLAN,
			weeks: [
				{
					start: "2026-08-10",
					sessions: [
						{ day: "Tuesday", type: "easy run", distanceKm: 8 },
						{ day: "Sunday", type: "long run", distanceKm: 24, detail: "24km Long Run" },
					],
				},
			],
		};
		const out = buildDashboard({
			activities: block("2026-08-11", 1, { distanceM: 8000 }),
			plan: planned,
			today: "2026-08-11",
		});

		expect(out.week.longRun).toEqual({
			date: "2026-08-16",
			targetKm: 24,
			actualKm: 0,
			status: "ahead",
		});
	});

	it("tells the run log which runs were the plan and which were extra", () => {
		// Monday and Tuesday planned; the runs land on Tuesday and Wednesday.
		const planned = {
			...PLAN,
			weeks: [
				{
					start: "2026-08-10",
					sessions: [
						{ day: "Monday", type: "rest", detail: "Rest" },
						{ day: "Tuesday", type: "easy run", distanceKm: 8, detail: "8km Easy Run" },
					],
				},
			],
		};
		const out = buildDashboard({
			activities: [
				...block("2026-08-11", 1, { distanceM: 8000 }),
				{ ...block("2026-08-12", 1, { distanceM: 6000 })[0], id: 2001 },
			],
			plan: planned,
			today: "2026-08-12",
		});

		// Newest first, as the log renders it.
		const [wednesday, tuesday] = out.runs;
		expect(tuesday.plan).toEqual({
			planned: true,
			type: "easy run",
			detail: "8km Easy Run",
			distanceKm: 8,
		});
		expect(wednesday.plan.planned).toBe(false);
	});

	it("keeps the plan match aligned with the runs the log actually carries", () => {
		// More runs than the log holds: the tail it ships must still be
		// matched against the right days.
		const planned = {
			...PLAN,
			weeks: [{ start: "2026-08-10", sessions: [{ day: "Tuesday", type: "long run", distanceKm: 24 }] }],
		};
		const out = buildDashboard({
			activities: block("2026-08-11", 40),
			plan: planned,
			today: "2026-08-11",
		});
		expect(out.runs).toHaveLength(30);
		expect(out.summary.totals.runs).toBe(40);
		expect(out.runs[0].plan.type).toBe("long run");
		expect(out.runs.filter((r) => r.plan.planned)).toHaveLength(1);
	});

	it("reports the week's targets from its sessions", () => {
		const planned = {
			...PLAN,
			weeks: [
				{
					start: "2026-08-10",
					// A stale weekly total that the sessions disagree with.
					targetKm: 99,
					longRunKm: 99,
					sessions: [
						{ day: "Tuesday", type: "easy run", distanceKm: 8 },
						{ day: "Sunday", type: "long run", distanceKm: 24 },
					],
				},
			],
		};
		const out = buildDashboard({ activities: [], plan: planned, today: "2026-08-11" });
		const week = out.weeks.find((w) => w.start === "2026-08-10");
		expect(week.targetKm).toBe(32);
		expect(week.longRunTargetKm).toBe(24);
	});

	it("has no week to lay out before the plan starts", () => {
		const out = buildDashboard({ activities: [], plan: PLAN, today: "2026-08-11" });
		expect(out.week === null || Array.isArray(out.week.days)).toBe(true);
	});

	it("reports fitness as of today, not the end of the series", () => {
		// The series runs forward to race day, where there are no runs yet;
		// reading the last entry would report a decayed CTL of nearly zero.
		const out = buildDashboard({
			activities: block("2026-08-11", 20),
			plan: PLAN,
			today: "2026-08-11",
		});
		expect(out.summary.latest.date).toBe("2026-08-11");
		expect(out.summary.latest.ctl).toBeGreaterThan(0);
	});

	it("stops the series at today rather than trailing to race day", () => {
		const out = buildDashboard({
			activities: block("2026-08-11", 10),
			plan: PLAN,
			today: "2026-08-11",
		});
		expect(out.series.at(-1).date).toBe("2026-08-11");
	});

	it("merges planned targets into the weekly view", () => {
		const out = buildDashboard({
			activities: block("2026-08-14", 4),
			plan: PLAN,
			today: "2026-08-14",
		});
		const week = out.weeks.find((w) => w.start === "2026-08-10");
		expect(week.targetKm).toBe(65);
		expect(week.keySessions).toHaveLength(1);
		expect(week.volumePct).toBeGreaterThan(0);
	});

	it("leaves targets null for weeks with no plan entered", () => {
		const out = buildDashboard({
			activities: block("2026-09-07", 4),
			plan: PLAN,
			today: "2026-09-07",
		});
		const week = out.weeks.find((w) => w.start === "2026-09-07");
		expect(week.targetKm).toBeNull();
		expect(week.volumePct).toBeNull();
	});

	it("does not fault an unfinished week for being under its target", () => {
		// Monday of a 65 km week: 12 km run is on pace, not a shortfall.
		const out = buildDashboard({
			activities: block("2026-08-10", 1),
			plan: PLAN,
			today: "2026-08-10",
		});
		expect(out.recommendations.map((r) => r.id)).not.toContain("volume-short");
	});

	it("reports ramp against the last whole week while a week is in progress", () => {
		// Measured on a Tuesday, the current week is one run deep. Comparing
		// it to a finished week would read as a near-total collapse in volume.
		const runs = [...block("2026-08-09", 4), ...block("2026-08-11", 1)];
		const out = buildDashboard({ activities: runs, plan: PLAN, today: "2026-08-11" });
		expect(out.summary.riskWeek.isCurrentWeek).toBe(false);
		expect(out.summary.riskWeek.start).toBe("2026-08-03");
		expect(out.summary.riskWeek.rampPct).not.toBe(-100);
	});

	it("reports ramp against the current week once it's complete", () => {
		const out = buildDashboard({
			activities: block("2026-08-16", 6),
			plan: PLAN,
			today: "2026-08-16", // a Sunday
		});
		expect(out.summary.riskWeek.isCurrentWeek).toBe(true);
		expect(out.summary.riskWeek.start).toBe("2026-08-10");
	});

	it("keeps the ramp warning's wording and metric on the same week", () => {
		// Week of Aug 3 quadruples the week before it, so the warning fires
		// off a completed week while the current week is one run deep.
		const runs = [...block("2026-08-09", 5), ...block("2026-08-11", 1)];
		const out = buildDashboard({ activities: runs, plan: PLAN, today: "2026-08-11" });
		const warn = out.recommendations.find((r) => r.id === "ramp-fast");
		expect(warn.metric).toBeCloseTo(out.summary.riskWeek.rampPct, 6);
		expect(warn.title).toContain("Last week");
		// The quoted volumes must be the pair the percentage came from.
		expect(warn.detail).toContain("12 to 48 km");
	});

	it("produces recommendations carrying their triggering metric", () => {
		const out = buildDashboard({
			activities: block("2026-08-11", 20),
			plan: PLAN,
			today: "2026-08-11",
		});
		expect(out.recommendations.length).toBeGreaterThan(0);
		for (const rec of out.recommendations) {
			expect(rec).toHaveProperty("metric");
			expect(rec).toHaveProperty("severity");
		}
	});

	it("returns the most recent runs, newest first", () => {
		const out = buildDashboard({
			activities: block("2026-08-11", 40),
			plan: PLAN,
			today: "2026-08-11",
		});
		expect(out.runs).toHaveLength(30);
		expect(out.runs[0].startDateLocal > out.runs[1].startDateLocal).toBe(true);
	});

	it("singles out the last run, with what it did to the week and to form", () => {
		const out = buildDashboard({
			activities: block("2026-08-11", 12),
			plan: PLAN,
			today: "2026-08-11",
		});

		expect(out.lastRun.date).toBe("2026-08-11");
		expect(out.lastRun.id).toBe(out.runs[0].id);
		expect(out.lastRun.impact.form.atlDelta).toBeGreaterThan(0);
		expect(out.lastRun.impact.week.start).toBe("2026-08-10");
		expect(out.lastRun.impact.load.vsTypicalPct).toBeGreaterThan(0);
	});

	it("has no last run to describe before anything is synced", () => {
		const out = buildDashboard({ activities: [], plan: PLAN, today: "2026-08-11" });
		expect(out.lastRun).toBeNull();
	});

	it("predicts a race time from best efforts", () => {
		const runs = block("2026-08-11", 6);
		runs[5].bestEfforts = [
			{ name: "10k", distanceM: 10000, timeSec: 2700, date: "2026-08-11" },
		];
		const out = buildDashboard({ activities: runs, plan: PLAN, today: "2026-08-11" });
		expect(out.summary.prediction.predictedSec).toBeGreaterThan(0);
		expect(out.summary.prediction.basis.distanceM).toBe(10000);
		expect(typeof out.summary.prediction.onTrack).toBe("boolean");
	});
});

describe("buildDashboard privacy, end to end", () => {
	// The full path a real activity takes: raw Strava payload through shaping
	// and into the JSON the public endpoint serves.
	const rawActivities = [
		{
			id: 1,
			name: "Private Long Run",
			"sport_type": "Run",
			private: true,
			"start_date_local": "2026-08-09T07:00:00",
			distance: 32000,
			"moving_time": 10000,
			"average_heartrate": 145,
			map: { "summary_polyline": "SECRETPOLYLINE" },
			"start_latlng": [43.6532, -79.3832],
		},
		{
			id: 2,
			name: "Public Easy Run",
			"sport_type": "Run",
			private: false,
			"start_date_local": "2026-08-11T07:00:00",
			distance: 10000,
			"moving_time": 3300,
			"average_heartrate": 140,
			map: { "summary_polyline": "PUBLICPOLYLINE" },
			"start_latlng": [43.6532, -79.3832],
			"splits_metric": [{ distance: 1000, "moving_time": 330, "elevation_difference": 5 }],
		},
	];

	const payload = buildDashboard({
		activities: shapeActivities(rawActivities, { thresholds: PLAN.thresholds }),
		plan: PLAN,
		today: "2026-08-11",
	});
	const json = JSON.stringify(payload);

	it("excludes the private run from the served payload", () => {
		expect(json).not.toContain("Private Long Run");
		expect(payload.runs.map((r) => r.id)).toEqual([2]);
	});

	it("excludes the private run from the aggregate totals", () => {
		// Not just hidden from the list — it must not inflate volume either.
		expect(payload.summary.totals.runs).toBe(1);
		expect(payload.summary.totals.distanceM).toBe(10000);
	});

	it("carries no route geometry for any run, public or private", () => {
		expect(json).not.toContain("POLYLINE");
		expect(json).not.toContain("polyline");
		expect(json).not.toContain("latlng");
		expect(json).not.toContain("43.65");
	});

	// The deep dive is the one place per-kilometre data is served, so it gets
	// the same treatment: what it needs to draw a pace profile, and no more.
	it("serves the last run's splits without their hill profile", () => {
		expect(payload.lastRun.id).toBe(2);
		expect(payload.lastRun.splits).toHaveLength(1);
		expect(Object.keys(payload.lastRun.splits[0]).sort()).toEqual([
			"averageHr",
			"gapPaceSecPerKm",
			"km",
			"paceSecPerKm",
		]);
	});
});

// A ride reaches the log and nothing else. The whole block below is one claim
// checked from several directions: the dashboard reads identically with a ride
// in it and without, apart from the row that shows it.
//
// Feeding fatigue alone was tried and reverted, and "costs fatigue, and so
// costs form" used to be a test here. It passed, which was the problem — form
// is fitness minus fatigue, so raising one and never the other doesn't make a
// ride cost you a few days of freshness, it moves form permanently down by
// roughly the daily ride load and never lets it back.
describe("buildDashboard with rides", () => {
	const RIDE = {
		id: 9001,
		name: "Long ride",
		sport: "ride",
		type: "Ride",
		// Yesterday rather than today: form is read from the state you woke up
		// with, so a ride logged this morning couldn't move today's number
		// even if rides counted. Dated to where it would show if it could.
		startDateLocal: "2026-08-10T07:00:00",
		distanceM: 60000,
		movingTimeSec: 7200,
		averageHr: 140,
		// Deliberately carrying a load. Rides are shaped unscored now, but
		// records written when they weren't are still in Blobs and served
		// until the sync re-shapes them. Counting for nothing is a property of
		// this module, not of the number happening to be zero.
		load: 90,
	};

	const runsOnly = () =>
		buildDashboard({ activities: block("2026-08-11", 10), plan: PLAN, today: "2026-08-11" });
	const withRide = () =>
		buildDashboard({
			activities: [...block("2026-08-11", 10), RIDE],
			plan: PLAN,
			today: "2026-08-11",
		});

	it("leaves weekly volume and long-run share to the runs", () => {
		const before = runsOnly();
		const after = withRide();
		expect(after.weeks.map((w) => w.distanceM)).toEqual(before.weeks.map((w) => w.distanceM));
		expect(after.weeks.map((w) => w.longRunSharePct)).toEqual(
			before.weeks.map((w) => w.longRunSharePct),
		);
		// 60 km on a bike is not a 60 km long run.
		expect(after.weeks.every((w) => w.longestRunM <= 12000)).toBe(true);
	});

	it("keeps rides out of the acute:chronic ratio", () => {
		// ACWR earns its keep as a running injury signal, and cycling doesn't
		// load the same tissues. Diluting it would cost more than it adds.
		expect(withRide().summary.acwr).toEqual(runsOnly().summary.acwr);
	});

	it("leaves totals, intensity and race prediction untouched", () => {
		const before = runsOnly();
		const after = withRide();
		expect(after.summary.totals).toEqual(before.summary.totals);
		expect(after.summary.intensity).toEqual(before.summary.intensity);
		expect(after.summary.prediction).toEqual(before.summary.prediction);
		// And so the advice, which is a reading of all of the above, says the
		// same thing rather than telling you to back off because you cycled.
		expect(after.recommendations).toEqual(before.recommendations);
	});

	it("touches neither fitness, fatigue nor form, on any day", () => {
		// The whole series, not just today: an offset that only shows up three
		// weeks later is exactly the failure this is here to catch.
		expect(withRide().series).toEqual(runsOnly().series);
		expect(withRide().summary.latest).toEqual(runsOnly().summary.latest);
	});

	it("shows the ride in the log, in date order, marked as a ride", () => {
		const log = withRide().runs;
		const ride = log.find((a) => a.id === RIDE.id);
		expect(ride).toBeTruthy();
		expect(ride.sport).toBe("ride");
		// Distance and time are what the row draws its speed from; a load it
		// doesn't count has no business being served.
		expect(ride.distanceM).toBe(60000);
		expect(ride.movingTimeSec).toBe(7200);
		expect(ride.load).toBeUndefined();
		expect(log.filter((a) => a.sport === "run")).toHaveLength(10);
		const dates = log.map((a) => a.startDateLocal);
		expect([...dates].sort().reverse()).toEqual(dates);
	});

	it("does not displace runs from the log", () => {
		expect(withRide().runs.filter((a) => a.sport === "run")).toHaveLength(
			runsOnly().runs.length,
		);
	});

	it("treats a record with no sport as a run, as every stored one is", () => {
		// Everything already in Blobs was written before rides were tracked,
		// and is served for as long as it takes the sync to re-shape it.
		const legacy = block("2026-08-11", 3);
		expect(legacy.every((a) => a.sport === undefined)).toBe(true);
		const out = buildDashboard({ activities: legacy, plan: PLAN, today: "2026-08-11" });
		expect(out.summary.totals.runs).toBe(3);
		expect(out.runs.every((a) => a.sport === "run")).toBe(true);
	});
});

// Recovery is the second input this page takes that isn't training load, and
// the rides taught the expensive version of this lesson: the fitness model is
// a closed system, and a second source reaching part of it breaks the
// equilibrium that makes form mean anything. So the same assertion as the
// rides get — every training number identical — except here it holds for the
// whole payload rather than only the model, because recovery earns its place
// in the recommendations instead.
describe("buildDashboard with recovery", () => {
	const hours = (h) => Math.round(h * 3600);

	// Four weeks of nights ending today, so the baselines have something to
	// be a baseline of.
	const nights = (patch = {}) =>
		Array.from({ length: 28 }, (_, i) => {
			const date = new Date(Date.UTC(2026, 6, 16 + i));
			return {
				day: date.toISOString().slice(0, 10),
				sleepSec: hours(8),
				restingHr: 47,
				averageHrv: 65,
				...patch,
			};
		});

	const withoutRing = () =>
		buildDashboard({ activities: block("2026-08-11", 10), plan: PLAN, today: "2026-08-11" });
	const withRing = (patch) =>
		buildDashboard({
			activities: block("2026-08-11", 10),
			plan: PLAN,
			today: "2026-08-11",
			recovery: nights(patch),
		});

	it("moves no training number at all", () => {
		const before = withoutRing();
		const after = withRing({ sleepSec: hours(4), restingHr: 62 });
		expect(after.series).toEqual(before.series);
		expect(after.summary.latest).toEqual(before.summary.latest);
		expect(after.summary.acwr).toEqual(before.summary.acwr);
		expect(after.summary.totals).toEqual(before.summary.totals);
		expect(after.weeks).toEqual(before.weeks);
	});

	it("carries the ring's own numbers into the payload", () => {
		const out = withRing();
		expect(out.recovery.sleep.recent).toBe(hours(8));
		expect(out.recovery.restingHr.recent).toBe(47);
		expect(out.recovery.latest.day).toBe("2026-08-11");
		expect(out.recovery.series.length).toBeGreaterThan(0);
	});

	it("is absent rather than empty when there's no ring", () => {
		// The panel should not exist at all, rather than drawing dashes.
		expect(withoutRing().recovery).toBeNull();
	});

	it("reaches the advice, which is the whole point of collecting it", () => {
		const ids = (out) => out.recommendations.map((r) => r.id);
		expect(ids(withRing())).toContain("recovery-ok");
		expect(ids(withoutRing())).not.toContain("recovery-ok");
	});

	it("reads sleep against the training rather than on its own", () => {
		// This block is itself a ramp — ten runs in ten days against nothing
		// before them — so five hours a night doesn't produce a note about
		// sleep beside a note about load. It produces the one about both,
		// which is the entire reason for collecting any of this.
		const out = withRing({ sleepSec: hours(5) });
		const ids = out.recommendations.map((r) => r.id);
		expect(ids).toContain("sleep-and-ramp");
		expect(ids).not.toContain("sleep-short");
		expect(out.recommendations[0].severity).toBe("critical");
	});
});

describe("legacy records", () => {
	it("treats a record with no sport as a run, as every stored one is", () => {
		// Everything already in Blobs was written before rides were tracked,
		// and is served for as long as it takes the sync to re-shape it.
		const legacy = block("2026-08-11", 3);
		expect(legacy.every((a) => a.sport === undefined)).toBe(true);
		const out = buildDashboard({ activities: legacy, plan: PLAN, today: "2026-08-11" });
		expect(out.summary.totals.runs).toBe(3);
		expect(out.runs.every((a) => a.sport === "run")).toBe(true);
	});
});
