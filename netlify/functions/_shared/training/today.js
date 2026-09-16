// Today's briefing, assembled from numbers the rest of the page already has.
//
// Last run is about the most recent session, which may have been Tuesday. The
// fitness series already files today even when you don't run — that's the
// rest-day tick on the chart. This module is the one object that answers
// "where does today stand right now": the FFF change from yesterday's close,
// readiness (see readiness.js), the planned session if it's still ahead, and
// what today's session did to the projected finish — not a second copy of it.
// The finish itself is always the shared engine in marathonProjection.js.
//
// Nothing here is fetched. The series, the day's plan row, last night, and the
// race efforts are handed in already final. Readiness sits beside form and
// still does not feed it.

import { projectMarathon, sessionProjectionDelta } from "./marathonProjection.js";
import { readiness } from "./readiness.js";

/**
 * What today's session looks like from the plan row.
 *
 * Same rules as WeekPlan's statusOf, except this is only ever asked about
 * today, so a blank planned day is "ahead" rather than "missed".
 *
 * @param {{planned?: object[], actualKm?: number}|null} day
 * @returns {"rest"|"ahead"|"done"|"extra"}
 */
export function sessionOf(day) {
	const planned = (day?.planned || []).filter((s) => s.isRun === true);
	const ran = (Number(day?.actualKm) || 0) > 0;
	if (planned.length === 0) return ran ? "extra" : "rest";
	if (ran) return "done";
	return "ahead";
}

function trainingOf(series, date) {
	const idx = (series || []).findIndex((d) => d.date === date);
	if (idx < 0) return null;
	const after = series[idx];
	const before = idx > 0 ? series[idx - 1] : null;
	return {
		ctl: after.ctl,
		atl: after.atl,
		tsb: after.tsb,
		load: after.load,
		ctlDelta: before ? after.ctl - before.ctl : null,
		atlDelta: before ? after.atl - before.atl : null,
		tsbDelta: before ? after.tsb - before.tsb : null,
	};
}

function sessionFrom(day) {
	return {
		status: sessionOf(day),
		planned: (day?.planned || []).map((s) => ({
			type: s.type,
			detail: s.detail,
			distanceKm: s.distanceKm,
			isRun: s.isRun === true,
		})),
		actualKm: Number(day?.actualKm) || 0,
		runs: Number(day?.runs) || 0,
	};
}

function predictionOf({ efforts, runs, targetDistanceM, goalTimeSec, date, ranToday, tsb }) {
	const after = projectMarathon({
		runs,
		efforts,
		today: date,
		targetDistanceM,
		goalTimeSec,
		tsb,
	});
	if (!after) return null;
	let sessionDeltaSec = null;
	if (ranToday) {
		sessionDeltaSec =
			sessionProjectionDelta({
				runs,
				efforts,
				today: date,
				date,
				targetDistanceM,
				goalTimeSec,
				tsb,
			})?.sessionDeltaSec ?? 0;
	}
	return {
		predictedSec: after.predictedSec,
		ranToday: Boolean(ranToday),
		sessionDeltaSec,
		unchangedReason: after.unchangedReason,
	};
}

/**
 * The strip payload for one day.
 *
 * @param {object} input
 * @param {string} input.date day key.
 * @param {object[]} [input.series] from fitnessSeries().
 * @param {object|null} [input.day] today's row from planDays().
 * @param {object|null} [input.recovery] from recoverySummary().
 * @param {object[]} [input.efforts] from collectBestEfforts().
 * @param {object[]} [input.runs] shaped runs, so training support can move.
 * @param {number} [input.targetDistanceM]
 * @param {number} [input.goalTimeSec]
 * @param {number|null} [input.tsb]
 * @returns {object}
 */
export function todayBriefing({
	date,
	series = [],
	day = null,
	recovery = null,
	efforts = [],
	runs = [],
	targetDistanceM = 42195,
	goalTimeSec = null,
	tsb = null,
} = {}) {
	const training = trainingOf(series, date);
	const session = sessionFrom(day);
	return {
		date,
		training,
		readiness: readiness({ tsb: training?.tsb ?? null, recovery }),
		session,
		prediction: predictionOf({
			efforts,
			runs,
			targetDistanceM,
			goalTimeSec,
			date,
			ranToday: session.actualKm > 0,
			tsb: tsb ?? training?.tsb ?? null,
		}),
	};
}
