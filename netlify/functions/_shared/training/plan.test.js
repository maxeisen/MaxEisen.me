import { describe, it, expect } from "vitest";
import {
	plannedWeek,
	daysToRace,
	isTaperWeek,
	comparePlan,
	blockRange,
	currentWeek,
	dayOfWeek,
	weeksToRace,
	remainingPlannedKm,
	upcomingWeeks,
	weekDays,
	isRunSession,
	sessionDate,
	weekSessions,
	plannedKm,
	plannedLongRunKm,
	plannedRunsByDay,
	matchRunsToPlan,
} from "./plan.js";

const PLAN = {
	race: { name: "Chicago Marathon", date: "2026-10-11", goalTimeSec: 13200, distanceM: 42195 },
	weeks: [
		{ start: "2026-08-10", targetKm: 65, longRunKm: 30, key: [{ type: "tempo", detail: "3x10min" }] },
		{ start: "2026-08-17", targetKm: 70, longRunKm: 32 },
		{ start: "2026-09-28", targetKm: 45, longRunKm: 16 },
	],
};

describe("plannedWeek", () => {
	it("finds the week by its Monday", () => {
		expect(plannedWeek(PLAN, "2026-08-10").targetKm).toBe(65);
	});

	it("returns null for a week with no plan entry", () => {
		expect(plannedWeek(PLAN, "2026-08-24")).toBeNull();
	});
});

describe("daysToRace", () => {
	it("counts forward to race day", () => {
		expect(daysToRace(PLAN, "2026-10-01")).toBe(10);
	});

	it("goes negative once the race has passed", () => {
		expect(daysToRace(PLAN, "2026-10-12")).toBe(-1);
	});
});

describe("isTaperWeek", () => {
	it("treats the final three weeks as taper", () => {
		expect(isTaperWeek(PLAN, "2026-10-05")).toBe(true); // race week
		expect(isTaperWeek(PLAN, "2026-09-28")).toBe(true);
		expect(isTaperWeek(PLAN, "2026-09-21")).toBe(true);
	});

	it("excludes earlier weeks", () => {
		expect(isTaperWeek(PLAN, "2026-09-14")).toBe(false);
		expect(isTaperWeek(PLAN, "2026-08-10")).toBe(false);
	});
});

describe("comparePlan", () => {
	const weeks = [
		{ start: "2026-08-10", distanceM: 60000, longestRunM: 28000, movingTimeSec: 0, load: 0, runs: 5 },
		{ start: "2026-08-24", distanceM: 50000, longestRunM: 20000, movingTimeSec: 0, load: 0, runs: 4 },
	];

	it("merges targets into weeks that have them", () => {
		const out = comparePlan(weeks, PLAN);
		expect(out[0].targetKm).toBe(65);
		expect(out[0].volumePct).toBeCloseTo(92.3, 1);
		expect(out[0].keySessions).toHaveLength(1);
	});

	it("leaves unplanned weeks null rather than calling them a 100% overrun", () => {
		// A missing plan entry means "no target set", not "target of zero".
		const out = comparePlan(weeks, PLAN);
		expect(out[1].targetKm).toBeNull();
		expect(out[1].volumePct).toBeNull();
		expect(out[1].actualKm).toBe(50);
	});
});

describe("sessions", () => {
	// A week as the plan file writes them: weekday names, no dates, and
	// non-running days sitting alongside the runs.
	const week = {
		start: "2026-06-22",
		targetKm: 32,
		longRunKm: 17,
		sessions: [
			{ day: "Sunday", type: "long run", distanceKm: 17, detail: "17km Progressive Long Run" },
			{ day: "Monday", type: "rest", detail: "Rest" },
			{ day: "Wednesday", type: "tempo", distanceKm: 7.5, detail: "Tempo 2-1-1" },
			{ day: "Friday", type: "easy run", distanceKm: 7.5, detail: "7.5km Easy Run" },
			{ day: "Friday", type: "strength", detail: "25m - 35m Legs & Core" },
		],
	};

	it("dates each session from its weekday and the week's Monday", () => {
		expect(sessionDate("2026-06-22", "Monday")).toBe("2026-06-22");
		expect(sessionDate("2026-06-22", "Sunday")).toBe("2026-06-28");
		expect(sessionDate("2026-06-22", "wednesday")).toBe("2026-06-24");
	});

	it("ignores a session with no recognisable weekday", () => {
		expect(sessionDate("2026-06-22", "Someday")).toBeNull();
		expect(weekSessions({ start: "2026-06-22", sessions: [{ day: "Someday" }] })).toEqual([]);
	});

	it("returns sessions in day order however they were written", () => {
		const out = weekSessions(week);
		expect(out.map((s) => s.date)).toEqual([
			"2026-06-22",
			"2026-06-24",
			"2026-06-26",
			"2026-06-26",
			"2026-06-28",
		]);
	});

	it("counts only the running types toward volume", () => {
		expect(isRunSession({ type: "easy run" })).toBe(true);
		expect(isRunSession({ type: "race" })).toBe(true);
		expect(isRunSession({ type: "strength" })).toBe(false);
		expect(isRunSession({ type: "rest" })).toBe(false);
		// Rest and strength days carry no distance, so a naive sum would still
		// land on 32 — this is really asserting they're excluded by type.
		expect(plannedKm(week)).toBe(32);
	});

	it("sums both sessions on a doubled day", () => {
		const doubled = {
			start: "2026-06-22",
			sessions: [
				{ day: "Friday", type: "easy run", distanceKm: 7.5 },
				{ day: "Friday", type: "easy run", distanceKm: 4 },
			],
		};
		expect(plannedKm(doubled)).toBe(11.5);
	});

	it("prefers the sessions over a stale weekly total", () => {
		// The day-by-day plan is the source of truth; an edited session
		// shouldn't leave the old targetKm standing.
		expect(plannedKm({ ...week, targetKm: 99 })).toBe(32);
	});

	it("falls back to the weekly total for a week entered without sessions", () => {
		expect(plannedKm({ start: "2026-08-10", targetKm: 65 })).toBe(65);
		expect(plannedLongRunKm({ start: "2026-08-10", longRunKm: 30 })).toBe(30);
	});

	it("takes the long run from its session, not the longest run of the week", () => {
		expect(plannedLongRunKm(week)).toBe(17);
	});

	it("reports no long run for a week that plans none", () => {
		// An all-easy week isn't a 5km long-run target that got missed.
		const easy = {
			start: "2026-07-06",
			longRunKm: 0,
			sessions: [
				{ day: "Wednesday", type: "easy run", distanceKm: 5 },
				{ day: "Sunday", type: "easy run", distanceKm: 5 },
			],
		};
		expect(plannedLongRunKm(easy)).toBe(0);
		expect(plannedKm(easy)).toBe(10);
	});

	it("treats race day as the long run", () => {
		const raceWeek = {
			start: "2026-10-05",
			sessions: [
				{ day: "Wednesday", type: "intervals", distanceKm: 6.5 },
				{ day: "Sunday", type: "race", distanceKm: 42.2 },
			],
		};
		expect(plannedLongRunKm(raceWeek)).toBe(42.2);
		expect(plannedKm(raceWeek)).toBe(48.7);
	});

	it("carries dated sessions through comparePlan", () => {
		const out = comparePlan(
			[{ start: "2026-06-22", distanceM: 32000, longestRunM: 17000, movingTimeSec: 0, load: 0, runs: 3 }],
			{ ...PLAN, weeks: [week] },
		);
		expect(out[0].targetKm).toBe(32);
		expect(out[0].longRunTargetKm).toBe(17);
		expect(out[0].sessions.find((s) => s.type === "tempo").date).toBe("2026-06-24");
	});

	it("distinguishes a scheduled rest week from an unplanned one", () => {
		const restWeek = {
			start: "2026-06-29",
			targetKm: 0,
			sessions: [
				{ day: "Monday", type: "strength", detail: "25m - 35m Full Body" },
				{ day: "Sunday", type: "rest", detail: "Rest" },
			],
		};
		const actuals = [
			{ start: "2026-06-29", distanceM: 0, longestRunM: 0, movingTimeSec: 0, load: 0, runs: 0 },
			{ start: "2026-07-13", distanceM: 0, longestRunM: 0, movingTimeSec: 0, load: 0, runs: 0 },
		];
		const out = comparePlan(actuals, { ...PLAN, weeks: [restWeek] });
		expect(out[0].targetKm).toBeNull();
		expect(out[0].isPlanned).toBe(true);
		expect(out[1].isPlanned).toBe(false);
	});

	it("reports upcoming targets from sessions", () => {
		const out = upcomingWeeks({ ...PLAN, weeks: [week] }, "2026-06-15");
		expect(out[0].targetKm).toBe(32);
		expect(out[0].longRunKm).toBe(17);
		expect(out[0].sessions).toHaveLength(5);
	});
});

describe("blockRange", () => {
	const runs = [{ startDateLocal: "2026-05-04T07:00:00" }, { startDateLocal: "2026-08-11T07:00:00" }];

	it("starts from the earliest run when it predates the plan", () => {
		// Fitness is a 42-day average, so the run-up history has to be in the
		// range or the block opens reporting a fitness of zero.
		const range = blockRange(PLAN, runs, "2026-08-11");
		expect(range.from).toBe("2026-05-04");
	});

	it("starts from the plan when it predates any run", () => {
		const range = blockRange(PLAN, [{ startDateLocal: "2026-09-01T07:00:00" }], "2026-09-01");
		expect(range.from).toBe("2026-08-10");
	});

	it("runs through to race day", () => {
		expect(blockRange(PLAN, runs, "2026-08-11").to).toBe("2026-10-11");
	});

	it("stops at today once the race has passed", () => {
		expect(blockRange(PLAN, runs, "2026-11-01").to).toBe("2026-11-01");
	});

	it("returns null with neither a plan nor any runs", () => {
		expect(blockRange({}, [], "2026-08-11")).toBeNull();
	});
});

describe("currentWeek", () => {
	it("finds the week containing today", () => {
		const weeks = [{ start: "2026-08-10" }, { start: "2026-08-17" }];
		expect(currentWeek(weeks, "2026-08-13").start).toBe("2026-08-10");
	});
});

describe("dayOfWeek", () => {
	it("counts Monday as day 1 and Sunday as day 7", () => {
		expect(dayOfWeek("2026-08-10")).toBe(1);
		expect(dayOfWeek("2026-08-16")).toBe(7);
	});
});

describe("weeksToRace", () => {
	it("rounds up to whole weeks", () => {
		expect(weeksToRace(PLAN, "2026-10-01")).toBe(2);
	});

	it("never goes negative after the race", () => {
		expect(weeksToRace(PLAN, "2026-10-20")).toBe(0);
	});
});

describe("remainingPlannedKm", () => {
	it("sums targets from this week onward", () => {
		expect(remainingPlannedKm(PLAN, "2026-08-17")).toBe(115);
	});

	it("returns null when nothing is planned ahead", () => {
		expect(remainingPlannedKm(PLAN, "2026-11-01")).toBeNull();
	});
});

describe("upcomingWeeks", () => {
	it("returns only later weeks, in order", () => {
		const out = upcomingWeeks(PLAN, "2026-08-10");
		expect(out.map((w) => w.start)).toEqual(["2026-08-17", "2026-09-28"]);
	});

	it("respects the limit", () => {
		expect(upcomingWeeks(PLAN, "2026-08-10", 1)).toHaveLength(1);
	});
});

describe("weekDays", () => {
	it("returns Monday through Sunday for the week containing a day", () => {
		const days = weekDays("2026-08-13");
		expect(days).toHaveLength(7);
		expect(days[0]).toBe("2026-08-10");
		expect(days[6]).toBe("2026-08-16");
	});
});

describe("plannedRunsByDay", () => {
	const PLAN_WITH_SESSIONS = {
		weeks: [
			{
				start: "2026-08-10",
				sessions: [
					{ day: "Monday", type: "rest" },
					{ day: "Tuesday", type: "easy run", distanceKm: 10, detail: "conversational" },
					{ day: "Tuesday", type: "strength" },
					{ day: "Wednesday", type: "intervals", distanceKm: 12, detail: "6x800m" },
					{ day: "Sunday", type: "long run", distanceKm: 30 },
				],
			},
		],
	};

	it("keys the block's running sessions by date", () => {
		const byDay = plannedRunsByDay(PLAN_WITH_SESSIONS);
		expect([...byDay.keys()]).toEqual(["2026-08-11", "2026-08-12", "2026-08-16"]);
		expect(byDay.get("2026-08-11")).toHaveLength(1);
	});

	it("leaves out rest and strength, which put no kilometres on your legs", () => {
		const byDay = plannedRunsByDay(PLAN_WITH_SESSIONS);
		expect(byDay.has("2026-08-10")).toBe(false);
		expect(byDay.get("2026-08-11")[0].type).toBe("easy run");
	});

	it("is empty for a plan entered as weekly totals only", () => {
		expect(plannedRunsByDay(PLAN).size).toBe(0);
	});
});

describe("matchRunsToPlan", () => {
	const PLAN_WITH_SESSIONS = {
		weeks: [
			{
				start: "2026-08-10",
				sessions: [
					{ day: "Tuesday", type: "easy run", distanceKm: 10, detail: "conversational" },
					{ day: "Wednesday", type: "intervals", distanceKm: 12, detail: "6x800m" },
					{ day: "Wednesday", type: "easy run", distanceKm: 5, detail: "shakeout" },
				],
			},
		],
	};

	const run = (startDateLocal) => ({ startDateLocal });

	it("tags a run with the session planned for its day", () => {
		const [match] = matchRunsToPlan([run("2026-08-11T06:30:00")], PLAN_WITH_SESSIONS);
		expect(match).toEqual({
			planned: true,
			type: "easy run",
			detail: "conversational",
			distanceKm: 10,
		});
	});

	it("marks a run on an unplanned day as extra", () => {
		const [match] = matchRunsToPlan([run("2026-08-13T07:00:00")], PLAN_WITH_SESSIONS);
		expect(match.planned).toBe(false);
		expect(match.type).toBeNull();
	});

	it("gives a day's second run the day's second session", () => {
		const matches = matchRunsToPlan(
			[run("2026-08-12T06:00:00"), run("2026-08-12T18:00:00")],
			PLAN_WITH_SESSIONS,
		);
		expect(matches.map((m) => m.type)).toEqual(["intervals", "easy run"]);
	});

	it("calls a double on a single-session day what it is", () => {
		const matches = matchRunsToPlan(
			[run("2026-08-11T06:00:00"), run("2026-08-11T18:00:00")],
			PLAN_WITH_SESSIONS,
		);
		expect(matches.map((m) => m.planned)).toEqual([true, false]);
	});

	it("returns one entry per run, in order, whatever the plan says", () => {
		const runs = [run("2026-08-11T06:00:00"), run(null), run("2026-08-30T06:00:00")];
		const matches = matchRunsToPlan(runs, { weeks: [] });
		expect(matches).toHaveLength(3);
		expect(matches.every((m) => m.planned === false)).toBe(true);
	});

	it("treats a plan with no day-level sessions as no match, not as a crash", () => {
		expect(matchRunsToPlan([run("2026-08-11T06:00:00")], PLAN)[0].planned).toBe(false);
		expect(matchRunsToPlan([run("2026-08-11T06:00:00")], null)[0].planned).toBe(false);
		expect(matchRunsToPlan(null, PLAN)).toEqual([]);
	});
});
