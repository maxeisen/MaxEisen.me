// Fitness, fatigue, form, and injury-risk ratios derived from daily load.
//
// The impulse-response idea: one training session raises both a slow-decaying
// "fitness" trace and a fast-decaying "fatigue" trace. Fitness is what you keep;
// fatigue is what you shed in a taper. Their difference is form — how ready you
// are to race today.
//
//   CTL (fitness) — 42-day exponentially weighted average of daily load
//   ATL (fatigue) —  7-day exponentially weighted average of daily load
//   TSB (form)    — yesterday's CTL minus yesterday's ATL
//
// TSB deliberately lags by a day: today's session shouldn't make you look less
// ready before you've done it, and a morning check-in would otherwise flip
// negative the moment a run uploads.
//
// Separately, ACWR (acute:chronic workload ratio) compares the last 7 days of
// load against the last 28. It's the standard early warning for ramping too
// fast — the injury-risk literature puts the safe corridor at roughly 0.8–1.5.

import { addDays, daysBetween, eachDay, mondayOf, toDayKey } from "./dates.js";

export const CTL_DAYS = 42;
export const ATL_DAYS = 7;
export const ACUTE_DAYS = 7;
export const CHRONIC_DAYS = 28;

// Injury-risk corridor for ACWR. Below the floor you're detraining; above the
// ceiling you're adding load faster than your body is adapting to it.
export const ACWR_FLOOR = 0.8;
export const ACWR_CEILING = 1.5;

// The conventional cap on week-over-week volume growth.
export const SAFE_RAMP_PCT = 10;

/**
 * Daily fitness/fatigue/form series across a date range.
 *
 * Rest days matter as much as run days here — an unbroken day-by-day series is
 * what lets fatigue actually decay during a taper — so the range is filled in
 * densely rather than iterating only the days that have activities.
 *
 * @param {Map<string, number>|object} loadsByDay day key to total load.
 * @param {{from: string, to: string}} range
 * @returns {{date: string, load: number, ctl: number, atl: number, tsb: number}[]}
 */
export function fitnessSeries(loadsByDay, { from, to }) {
	const lookup = loadsByDay instanceof Map ? loadsByDay : new Map(Object.entries(loadsByDay || {}));
	const days = eachDay(from, to);
	if (days.length === 0) return [];

	const ctlAlpha = 1 / CTL_DAYS;
	const atlAlpha = 1 / ATL_DAYS;

	let ctl = 0;
	let atl = 0;
	return days.map((date) => {
		// Form reflects the state you woke up with, before today's session.
		const tsb = ctl - atl;
		const load = Number(lookup.get(date)) || 0;
		ctl += (load - ctl) * ctlAlpha;
		atl += (load - atl) * atlAlpha;
		return { date, load, ctl, atl, tsb };
	});
}

/**
 * Mean daily load over the `days` window ending on `date` (inclusive).
 *
 * @param {Map<string, number>} loadsByDay
 * @param {string} date
 * @param {number} days
 * @returns {number}
 */
export function rollingMean(loadsByDay, date, days) {
	const start = addDays(date, -(days - 1));
	if (!start) return 0;
	let total = 0;
	for (const day of eachDay(start, date)) total += Number(loadsByDay.get(day)) || 0;
	return total / days;
}

/**
 * Acute:chronic workload ratio on a given day.
 *
 * @param {Map<string, number>|object} loadsByDay
 * @param {string} date
 * @returns {{ratio: number|null, acute: number, chronic: number}} ratio is null
 *   when there's no chronic load to compare against (a fresh start, where any
 *   ratio would be a meaningless division by ~zero).
 */
export function acwr(loadsByDay, date) {
	const lookup = loadsByDay instanceof Map ? loadsByDay : new Map(Object.entries(loadsByDay || {}));
	const acute = rollingMean(lookup, date, ACUTE_DAYS);
	const chronic = rollingMean(lookup, date, CHRONIC_DAYS);
	return { ratio: chronic > 0 ? acute / chronic : null, acute, chronic };
}

/**
 * Group activities into Monday-anchored training weeks.
 *
 * @param {object[]} activities shaped activities.
 * @param {{from?: string, to?: string}} [range] when given, weeks with no runs
 *   are still emitted, so a missed week shows as a zero rather than vanishing.
 * @returns {{start: string, distanceM: number, movingTimeSec: number, load: number,
 *   runs: number, longestRunM: number}[]} ordered oldest first.
 */
export function weeklySummaries(activities, range = {}) {
	const weeks = new Map();

	const ensure = (start) => {
		if (!weeks.has(start)) {
			weeks.set(start, {
				start,
				distanceM: 0,
				movingTimeSec: 0,
				load: 0,
				runs: 0,
				longestRunM: 0,
			});
		}
		return weeks.get(start);
	};

	if (range.from && range.to) {
		let cursor = mondayOf(range.from);
		const last = mondayOf(range.to);
		while (cursor && last && daysBetween(cursor, last) >= 0) {
			ensure(cursor);
			cursor = addDays(cursor, 7);
		}
	}

	for (const a of activities || []) {
		const day = toDayKey(a?.startDateLocal);
		const start = day && mondayOf(day);
		if (!start) continue;
		const week = ensure(start);
		const distanceM = Number(a.distanceM) || 0;
		week.distanceM += distanceM;
		week.movingTimeSec += Number(a.movingTimeSec) || 0;
		week.load += Number(a.load) || 0;
		week.runs += 1;
		week.longestRunM = Math.max(week.longestRunM, distanceM);
	}

	return [...weeks.values()].sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Week-over-week change in volume, as a percentage.
 *
 * @param {number} current metres this week.
 * @param {number} previous metres last week.
 * @returns {number|null} null when there's no baseline to compare against.
 */
export function rampRate(current, previous) {
	if (!(previous > 0)) return null;
	return ((current - previous) / previous) * 100;
}

/**
 * Share of a week's distance taken by its longest run. Marathon plans usually
 * keep this near 30% — much beyond that and the week is one big run plus
 * filler, which is a common way to end up hurt.
 *
 * @param {{distanceM: number, longestRunM: number}} week
 * @returns {number|null}
 */
export function longRunShare(week) {
	const total = Number(week?.distanceM) || 0;
	if (!(total > 0)) return null;
	return ((Number(week.longestRunM) || 0) / total) * 100;
}
