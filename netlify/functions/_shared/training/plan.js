// Comparing what was planned against what was actually run.
//
// The plan file is authored by hand and will usually be incomplete — weeks get
// filled in a few at a time, and the block is already underway. So every
// function here treats a missing plan week as "no target set" rather than as a
// target of zero, which would otherwise report a perfectly good week as a
// catastrophic overrun.

import { addDays, daysBetween, mondayOf, toDayKey } from "./dates.js";

// A marathon taper is conventionally the last three weeks.
export const TAPER_WEEKS = 3;

// Weekday names to their offset from the week's Monday. Sessions carry a
// weekday rather than a date and `start` is always a Monday, so the date is
// derived here rather than authored twice and left to drift apart.
const DAY_OFFSETS = {
	monday: 0,
	tuesday: 1,
	wednesday: 2,
	thursday: 3,
	friday: 4,
	saturday: 5,
	sunday: 6,
};

// Session types that put kilometres on your legs. Strength and rest days are in
// the plan for completeness, and counting them would inflate every target.
export const RUN_SESSION_TYPES = new Set(["easy run", "long run", "tempo", "intervals", "race"]);

// What counts as the week's long run. A week can be all easy running with no
// long run at all, which is why this is a type check rather than "the longest
// run of the week" — a 5 km easy day isn't a long-run target that was missed.
const LONG_RUN_TYPES = new Set(["long run", "race"]);

const typeOf = (session) => String(session?.type || "").trim().toLowerCase();

/**
 * Does this session contribute running volume?
 *
 * @param {{type?: string}} session
 * @returns {boolean}
 */
export function isRunSession(session) {
	return RUN_SESSION_TYPES.has(typeOf(session));
}

/**
 * The date a session falls on, from its weekday and its week's Monday.
 *
 * @param {string} weekStart Monday key.
 * @param {string} day weekday name, e.g. "Wednesday".
 * @returns {string|null}
 */
export function sessionDate(weekStart, day) {
	const start = mondayOf(weekStart);
	const offset = DAY_OFFSETS[String(day || "").trim().toLowerCase()];
	if (!start || offset === undefined) return null;
	return addDays(start, offset);
}

/**
 * A planned week's sessions, dated and in day order.
 *
 * @param {object} week a plan week.
 * @returns {object[]} each session with `date` and `isRun` added.
 */
export function weekSessions(week) {
	if (!Array.isArray(week?.sessions)) return [];
	return week.sessions
		.map((s) => ({ ...s, date: sessionDate(week.start, s?.day), isRun: isRunSession(s) }))
		.filter((s) => s.date)
		.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Planned running kilometres for a week.
 *
 * Summed from the sessions when they're present, so the day-by-day plan is the
 * single source of truth and an edited session can't leave a stale weekly
 * total behind. `targetKm` is the fallback for weeks entered as a total only.
 *
 * @param {object} week
 * @returns {number}
 */
export function plannedKm(week) {
	const sessions = weekSessions(week);
	if (sessions.length === 0) return Number(week?.targetKm) || 0;
	const total = sessions.reduce((sum, s) => sum + (s.isRun ? Number(s.distanceKm) || 0 : 0), 0);
	return Number(total.toFixed(2));
}

/**
 * The week's planned long run, or 0 where the week has none.
 *
 * @param {object} week
 * @returns {number}
 */
export function plannedLongRunKm(week) {
	const sessions = weekSessions(week);
	if (sessions.length === 0) return Number(week?.longRunKm) || 0;
	const longs = sessions.filter((s) => LONG_RUN_TYPES.has(typeOf(s)));
	return longs.length === 0 ? 0 : Math.max(...longs.map((s) => Number(s.distanceKm) || 0));
}

/**
 * The week's long run, as the session it is rather than a running total.
 *
 * The long run happens on one day. Measuring it the way volume is measured —
 * kilometres so far against the target — gives "9.3 of 24" on a Tuesday, which
 * isn't a partly-finished long run but the longest easy run of the week so far,
 * counted a second time. The same kilometres fill both bars, and by Saturday
 * the long run looks two thirds done without having been started.
 *
 * So it's answered as a question about a day: is it still ahead of you, did you
 * do it, or did the day go by. Day-anchored like the rest of the plan matching,
 * which means a long run moved to Saturday reads as a missed Sunday and an
 * extra Saturday — the same story the day list tells directly below it.
 *
 * @param {object} week a week from comparePlan(), carrying its sessions.
 * @param {object[]} runs shaped activities.
 * @param {string} today day key.
 * @returns {{date: string, targetKm: number|null, actualKm: number,
 *   status: "done"|"missed"|"ahead"}|null} null for a week with no long run
 *   planned, which is a normal week rather than a failed one.
 */
export function weekLongRun(week, runs, today) {
	const session = (week?.sessions || []).find((s) => LONG_RUN_TYPES.has(typeOf(s)));
	if (!session?.date) {
		return null;
	}

	// The longest run of that day, not the day's total: a shakeout after the
	// long run is a double, not twenty-nine kilometres of long run.
	const onTheDay = (runs || [])
		.filter((run) => toDayKey(run?.startDateLocal) === session.date)
		.map((run) => (Number(run.distanceM) || 0) / 1000);
	const actualKm = onTheDay.length > 0 ? Math.max(...onTheDay) : 0;
	const targetKm = Number(session.distanceKm) || null;

	return {
		date: session.date,
		targetKm,
		actualKm,
		status: longRunStatus(actualKm, session.date, today),
	};
}

function longRunStatus(actualKm, date, today) {
	if (actualKm > 0) {
		return "done";
	}
	// A day is only missed once it's over: at 8am on Sunday the long run is
	// still ahead of you, and calling it missed would be both wrong and
	// demoralising.
	return date < toDayKey(today) ? "missed" : "ahead";
}

/**
 * The planned week whose Monday matches a given week start.
 *
 * @param {object} plan the parsed plan file.
 * @param {string} weekStart Monday key.
 * @returns {object|null}
 */
export function plannedWeek(plan, weekStart) {
	const weeks = plan?.weeks;
	if (!Array.isArray(weeks)) return null;
	return weeks.find((w) => mondayOf(w?.start) === weekStart) || null;
}

/**
 * Days from `today` to race day. Negative once the race has passed.
 *
 * @param {object} plan
 * @param {string} today day key.
 * @returns {number|null}
 */
export function daysToRace(plan, today) {
	const raceDay = toDayKey(plan?.race?.date);
	const from = toDayKey(today);
	if (!raceDay || !from) return null;
	return daysBetween(from, raceDay);
}

/**
 * Is a week inside the taper?
 *
 * @param {object} plan
 * @param {string} weekStart
 * @returns {boolean}
 */
export function isTaperWeek(plan, weekStart) {
	const raceDay = toDayKey(plan?.race?.date);
	if (!raceDay || !weekStart) return false;
	const raceWeek = mondayOf(raceDay);
	const weeksOut = daysBetween(weekStart, raceWeek) / 7;
	return weeksOut >= 0 && weeksOut < TAPER_WEEKS;
}

/**
 * Merge actual weekly totals with their planned targets.
 *
 * @param {object[]} weeks from weeklySummaries().
 * @param {object} plan
 * @returns {object[]} each week with its target, completion percentage and
 *   key sessions, where a plan exists for it.
 */
export function comparePlan(weeks, plan) {
	return (weeks || []).map((week) => {
		const planned = plannedWeek(plan, week.start);
		const targetKm = plannedKm(planned);
		const actualKm = week.distanceM / 1000;
		const longRunKm = plannedLongRunKm(planned);

		return {
			...week,
			actualKm,
			// null rather than 0 so "no plan entered" is distinguishable from
			// "planned zero", which the UI and the rules both care about.
			targetKm: targetKm > 0 ? targetKm : null,
			longRunTargetKm: longRunKm > 0 ? longRunKm : null,
			volumePct: targetKm > 0 ? (actualKm / targetKm) * 100 : null,
			keySessions: Array.isArray(planned?.key) ? planned.key : [],
			sessions: weekSessions(planned),
			// A planned week with no running is a scheduled down week, which
			// reads very differently from a week the plan says nothing about.
			isPlanned: Boolean(planned),
			isTaper: isTaperWeek(plan, week.start),
		};
	});
}

/**
 * The training block's date range: from whichever came first, the plan or the
 * earliest run we know about, through to race day.
 *
 * Taking the earlier of the two matters. Fitness is a 42-day average, so
 * starting the series at the plan's first week would report a fitness of
 * roughly zero on day one and spend six weeks catching up — while discarding
 * the months of run-up history the sync deliberately fetches for exactly this
 * purpose.
 *
 * @param {object} plan
 * @param {object[]} activities shaped activities.
 * @param {string} today
 * @returns {{from: string, to: string}|null}
 */
export function blockRange(plan, activities, today) {
	const planStarts = (plan?.weeks || [])
		.map((w) => mondayOf(w?.start))
		.filter(Boolean)
		.sort();
	const runDays = (activities || [])
		.map((a) => toDayKey(a?.startDateLocal))
		.filter(Boolean)
		.sort();

	const firstRunWeek = runDays[0] ? mondayOf(runDays[0]) : null;
	const candidates = [planStarts[0], firstRunWeek].filter(Boolean).sort();
	const from = candidates[0];
	if (!from) return null;

	// Run to race day, or to today if the race has already happened, so the
	// chart never trails off into empty future weeks after the event.
	const raceDay = toDayKey(plan?.race?.date);
	const to = raceDay && daysBetween(toDayKey(today), raceDay) > 0 ? raceDay : toDayKey(today);
	return to ? { from, to } : null;
}

/**
 * The week currently in progress.
 *
 * @param {object[]} comparedWeeks
 * @param {string} today
 * @returns {object|null}
 */
export function currentWeek(comparedWeeks, today) {
	const start = mondayOf(today);
	return (comparedWeeks || []).find((w) => w.start === start) || null;
}

/**
 * How far through the week we are, used to judge volume fairly mid-week —
 * being at 40% of the target on a Wednesday is on pace, not behind.
 *
 * @param {string} today
 * @returns {number} 1-7.
 */
export function dayOfWeek(today) {
	const start = mondayOf(today);
	const elapsed = daysBetween(start, toDayKey(today));
	return Number.isFinite(elapsed) ? elapsed + 1 : 1;
}

/**
 * Race-week Monday, for countdown display.
 *
 * @param {object} plan
 * @returns {string|null}
 */
export function raceWeekStart(plan) {
	const raceDay = toDayKey(plan?.race?.date);
	return raceDay ? mondayOf(raceDay) : null;
}

/**
 * Number of whole weeks left before race day.
 *
 * @param {object} plan
 * @param {string} today
 * @returns {number|null}
 */
export function weeksToRace(plan, today) {
	const days = daysToRace(plan, today);
	return days === null ? null : Math.max(0, Math.ceil(days / 7));
}

/**
 * Sum of planned kilometres still ahead, for a sense of what's left.
 *
 * @param {object} plan
 * @param {string} today
 * @returns {number|null}
 */
export function remainingPlannedKm(plan, today) {
	const weeks = plan?.weeks;
	if (!Array.isArray(weeks) || weeks.length === 0) return null;
	const thisWeek = mondayOf(today);
	let total = 0;
	let counted = 0;
	for (const w of weeks) {
		const start = mondayOf(w?.start);
		if (!start || !thisWeek || daysBetween(thisWeek, start) < 0) continue;
		const km = plannedKm(w);
		if (km > 0) {
			total += km;
			counted += 1;
		}
	}
	return counted > 0 ? total : null;
}

/**
 * Later weeks first, for the "next up" view.
 *
 * @param {object} plan
 * @param {string} today
 * @param {number} [limit]
 * @returns {object[]}
 */
export function upcomingWeeks(plan, today, limit = 4) {
	const thisWeek = mondayOf(today);
	return (plan?.weeks || [])
		.map((w) => ({
			...w,
			start: mondayOf(w?.start),
			targetKm: plannedKm(w),
			longRunKm: plannedLongRunKm(w),
			sessions: weekSessions(w),
		}))
		.filter((w) => w.start && thisWeek && daysBetween(thisWeek, w.start) > 0)
		.sort((a, b) => a.start.localeCompare(b.start))
		.slice(0, limit);
}

/**
 * Every planned running session in the block, grouped by the day it falls on.
 *
 * @param {object} plan
 * @returns {Map<string, object[]>}
 */
export function plannedRunsByDay(plan) {
	const byDay = new Map();
	for (const week of plan?.weeks || []) {
		for (const session of weekSessions(week)) {
			if (!session.isRun) continue;
			const list = byDay.get(session.date);
			if (list) list.push(session);
			else byDay.set(session.date, [session]);
		}
	}
	return byDay;
}

/**
 * Tag each run with the planned session it fulfilled, or as an extra.
 *
 * Matching is by day, in order: the first run on a day takes the first session
 * planned for it, and so on. A day with two planned sessions and one run
 * therefore leaves the second unclaimed, and a second run on a single-session
 * day comes back as an extra — which is what a double is.
 *
 * Nothing here tries to check that the run resembles the session. A 6 km
 * shuffle on a day the plan wanted 6×800m is still the day's session, run
 * badly; calling it an extra because the distance disagreed would be a worse
 * lie than calling it planned.
 *
 * @param {object[]} runs shaped activities, ascending by start time.
 * @param {object} plan
 * @returns {{planned: boolean, type: string|null, detail: string|null,
 *   distanceKm: number|null}[]} one entry per run, in the same order.
 */
export function matchRunsToPlan(runs, plan) {
	const byDay = plannedRunsByDay(plan);
	const claimed = new Map();

	return (runs || []).map((run) => {
		const day = toDayKey(run?.startDateLocal);
		const sessions = (day && byDay.get(day)) || [];
		const used = claimed.get(day) || 0;
		const session = sessions[used];
		if (!session) return { planned: false, type: null, detail: null, distanceKm: null };
		claimed.set(day, used + 1);
		return {
			planned: true,
			type: session.type || null,
			detail: session.detail || null,
			distanceKm: Number.isFinite(Number(session.distanceKm)) ? Number(session.distanceKm) : null,
		};
	});
}

/**
 * Day keys for the current week, Monday through Sunday.
 *
 * @param {string} today
 * @returns {string[]}
 */
export function weekDays(today) {
	const start = mondayOf(today);
	if (!start) return [];
	return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
