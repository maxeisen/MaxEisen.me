// The last run, in enough detail to answer "what did that do to my training?"
//
// Every other panel on the dashboard is trend-shaped: twelve weeks of volume, a
// block of fitness, four weeks of intensity. None of them answer the question
// you actually have on the walk home, which is what that particular run was and
// what it changed. This module is that answer, about exactly one activity.
//
// Nothing here is fetched: the splits, zone seconds, decoupling and load were
// all computed at sync time (see shape.js), and the fitness series is the one
// the rest of the dashboard is drawn from. The work is reading a single run
// against the athlete's own recent history, since none of these numbers mean
// anything in isolation — a load of 90 is a big day or a Tuesday depending
// entirely on whose 90 it is.

import { addDays, daysBetween, toDayKey } from "./dates.js";
import { publicLastRun } from "./shape.js";
import { classifyByPace } from "./zones.js";

// How far back "a typical run for you" reaches. Six weeks holds a few long runs
// and a down week without stretching into a different phase of the block.
const TYPICAL_WINDOW_DAYS = 42;

// Halves of a run only say something when there are enough kilometres in each.
const MIN_SPLITS_FOR_HALVES = 4;

// A closing 200 m split has the pace of whatever the last thirty seconds were,
// so short splits are ranked out of the fastest/slowest line rather than
// winning it.
const MIN_SPLIT_M = 600;

// Where a run stops being easy, by the share of its time spent above zone 2.
const HARD_SHARE_PCT = 20;
const MODERATE_SHARE_PCT = 35;

const sum = (values) => values.reduce((total, v) => total + (Number(v) || 0), 0);

function median(values) {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * What the day's running did to fitness, fatigue and form.
 *
 * fitnessSeries reports a day's ctl/atl *after* that day's load, but its tsb as
 * the form you woke up with, before it (see fitness.js). Taking ctl and atl
 * from the day before and the day itself therefore brackets the run cleanly,
 * and form is recomputed from those rather than read off, so all three deltas
 * describe the same moment.
 *
 * @param {object[]} series from fitnessSeries().
 * @param {string} date day key of the run.
 * @returns {object|null} null on the first day of the block, which has no
 *   day before it to compare against.
 */
function formImpact(series, date) {
	const idx = (series || []).findIndex((d) => d.date === date);
	if (idx < 1) return null;

	const before = series[idx - 1];
	const after = series[idx];
	const formBefore = before.ctl - before.atl;
	const formAfter = after.ctl - after.atl;

	return {
		dayLoad: after.load,
		ctl: after.ctl,
		ctlDelta: after.ctl - before.ctl,
		atl: after.atl,
		atlDelta: after.atl - before.atl,
		tsb: formAfter,
		tsbDelta: formAfter - formBefore,
	};
}

/** Runs of the six weeks before this one, oldest first. */
function recentBefore(runs, date) {
	const from = addDays(date, -TYPICAL_WINDOW_DAYS);
	return runs.slice(0, -1).filter((run) => {
		const day = toDayKey(run.startDateLocal);
		return day && day >= from && day <= date;
	});
}

/**
 * How long since a run cost this much. The honest version of "that was a big
 * one": a load only means something next to the loads around it.
 *
 * @returns {number|null} days since the last run at least this hard, or null
 *   when nothing in the block matches it.
 */
function daysSinceAsHard(previous, load, date) {
	if (!(load > 0)) return null;
	for (let i = previous.length - 1; i >= 0; i--) {
		if ((Number(previous[i].load) || 0) >= load) {
			return daysBetween(toDayKey(previous[i].startDateLocal), date);
		}
	}
	return null;
}

function loadImpact(run, previous, date) {
	const load = Number.isFinite(run.load) ? run.load : null;
	const typical = median(previous.map((r) => Number(r.load) || 0).filter((v) => v > 0));

	return {
		load,
		typicalLoad: typical,
		// Above 100% is a harder run than your median; the ratio travels
		// better between athletes than either number does.
		vsTypicalPct: load > 0 && typical > 0 ? (load / typical) * 100 : null,
		daysSinceAsHard: daysSinceAsHard(previous, load, date),
		runsCompared: previous.length,
	};
}

/** The week the run landed in, and how much of it this one run was. */
function weekImpact(weeks, run, date) {
	const week = (weeks || []).find((w) => w.start <= date && date <= addDays(w.start, 6));
	if (!week) return null;

	const distanceKm = (Number(run.distanceM) || 0) / 1000;
	const targetKm = Number.isFinite(week.targetKm) ? week.targetKm : null;

	return {
		start: week.start,
		actualKm: Number.isFinite(week.actualKm) ? week.actualKm : null,
		targetKm,
		// Against the target where there is one: "a third of the week" is a
		// statement about the plan, not about how much else got run.
		sharePct: targetKm > 0 ? (distanceKm / targetKm) * 100 : null,
	};
}

function paceOver(splits) {
	const distanceM = sum(splits.map((s) => s.distanceM));
	const timeSec = sum(splits.map((s) => s.timeSec));
	return distanceM > 0 && timeSec > 0 ? timeSec / (distanceM / 1000) : null;
}

/**
 * How the run was paced: did it hold together, and where were its edges?
 *
 * Halved by kilometre rather than by time, because the halves are being
 * compared on pace and a time-halved run puts more distance in the faster half
 * by construction.
 *
 * @param {object[]} splits stored per-kilometre splits.
 * @returns {object|null}
 */
function pacing(splits) {
	const list = (splits || []).filter((s) => s.distanceM > 0 && s.timeSec > 0);
	if (list.length < MIN_SPLITS_FOR_HALVES) return null;

	const half = Math.floor(list.length / 2);
	const firstHalfPaceSecPerKm = paceOver(list.slice(0, half));
	const secondHalfPaceSecPerKm = paceOver(list.slice(half));
	const ranked = list
		.filter((s) => s.distanceM >= MIN_SPLIT_M)
		.sort((a, b) => a.paceSecPerKm - b.paceSecPerKm);

	return {
		firstHalfPaceSecPerKm,
		secondHalfPaceSecPerKm,
		// Positive is a fade, negative a negative split — the way round every
		// coach says it, so the sign doesn't need explaining.
		fadePct:
			firstHalfPaceSecPerKm > 0 && secondHalfPaceSecPerKm > 0
				? ((secondHalfPaceSecPerKm - firstHalfPaceSecPerKm) / firstHalfPaceSecPerKm) * 100
				: null,
		fastest: ranked[0] ? { km: ranked[0].km, paceSecPerKm: ranked[0].paceSecPerKm } : null,
		slowest: ranked.at(-1) ? { km: ranked.at(-1).km, paceSecPerKm: ranked.at(-1).paceSecPerKm } : null,
	};
}

/** Time in zones 1–5 rolled up the way the intensity panel says it. */
function zoneMix(zoneSeconds) {
	if (!Array.isArray(zoneSeconds)) return null;
	const totalSec = sum(zoneSeconds);
	if (!(totalSec > 0)) return null;

	const easySec = (zoneSeconds[0] || 0) + (zoneSeconds[1] || 0);
	const moderateSec = zoneSeconds[2] || 0;
	const hardSec = (zoneSeconds[3] || 0) + (zoneSeconds[4] || 0);

	return {
		easySec,
		moderateSec,
		hardSec,
		totalSec,
		easyPct: (easySec / totalSec) * 100,
		moderatePct: (moderateSec / totalSec) * 100,
		hardPct: (hardSec / totalSec) * 100,
	};
}

/**
 * Easy, moderate or hard — from where the heart rate actually sat, falling back
 * to grade-adjusted pace for a run recorded without a strap.
 */
function effortOf(mix, run, thresholds) {
	if (!mix) return classifyByPace(run.gapPaceSecPerKm, thresholds);
	if (mix.hardPct >= HARD_SHARE_PCT) return "hard";
	if (mix.moderatePct >= MODERATE_SHARE_PCT) return "moderate";
	return "easy";
}

/**
 * The newest run in the block, with the context that makes it readable.
 *
 * @param {object} input
 * @param {object[]} input.runs shaped activities, oldest first.
 * @param {object[]} input.series from fitnessSeries().
 * @param {object[]} input.weeks compared plan weeks.
 * @param {object} [input.planMatch] the plan match for this run, if any.
 * @param {object} [input.thresholds] from the plan file.
 * @param {string} input.today day key.
 * @returns {object|null} null when nothing has been run yet.
 */
export function lastRunDetail({ runs = [], series = [], weeks = [], planMatch = null, thresholds = {}, today }) {
	const run = runs.at(-1);
	if (!run) return null;

	const date = toDayKey(run.startDateLocal);
	const previous = recentBefore(runs, date);
	const mix = zoneMix(run.zoneSeconds);

	return {
		...publicLastRun(run),
		date,
		daysAgo: daysBetween(date, today),
		// A double day's form change belongs to both runs, and saying so is
		// better than quietly attributing it to the second one.
		runsThatDay: runs.filter((r) => toDayKey(r.startDateLocal) === date).length,
		plan: planMatch,
		effort: effortOf(mix, run, thresholds),
		zoneMix: mix,
		// The per-kilometre list itself comes from publicLastRun; this is what
		// it adds up to.
		pacing: pacing(run.splits),
		impact: {
			form: formImpact(series, date),
			load: loadImpact(run, previous, date),
			week: weekImpact(weeks, run, date),
		},
	};
}
