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
import { publicLastRun, WHOLE_SPLIT_M } from "./shape.js";
import { classifyByPace } from "./zones.js";

// How far back "a typical run for you" reaches. Six weeks holds a few long runs
// and a down week without stretching into a different phase of the block.
const TYPICAL_WINDOW_DAYS = 42;

// Halves of a run only say something when there are enough kilometres in each.
const MIN_SPLITS_FOR_HALVES = 4;

// Where a run stops being easy, by the share of its time spent above zone 2.
const HARD_SHARE_PCT = 20;
const MODERATE_SHARE_PCT = 35;

const number = (value) => Number(value) || 0;
const finite = (value) => (Number.isFinite(value) ? value : null);
const sum = (values) => values.reduce((total, v) => total + number(v), 0);

function median(values) {
	if (values.length === 0) {
		return null;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	const lower = sorted.at(mid - 1);
	const upper = sorted.at(mid);
	return sorted.length % 2 ? upper : (lower + upper) / 2;
}

/**
 * What the day's running did to fitness, fatigue and form.
 *
 * Each record in the series is the state at the end of its day, so the day
 * before and the day itself bracket the run and all three deltas describe the
 * same pair of moments.
 *
 * @param {object[]} series from fitnessSeries().
 * @param {string} date day key of the run.
 * @returns {object|null} null on the first day of the block, which has no
 *   day before it to compare against.
 */
function formImpact(series, date) {
	const idx = (series || []).findIndex((d) => d.date === date);
	if (idx < 1) {
		return null;
	}

	const before = series.at(idx - 1);
	const after = series.at(idx);

	return {
		dayLoad: after.load,
		ctl: after.ctl,
		ctlDelta: after.ctl - before.ctl,
		atl: after.atl,
		atlDelta: after.atl - before.atl,
		tsb: after.tsb,
		tsbDelta: after.tsb - before.tsb,
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
	const match = load > 0 ? previous.findLast((run) => number(run.load) >= load) : null;
	if (!match) {
		return null;
	}
	return daysBetween(toDayKey(match.startDateLocal), date);
}

function loadImpact(run, previous, date) {
	const load = finite(run.load);
	const typical = median(previous.map((r) => number(r.load)).filter((v) => v > 0));
	const comparable = load > 0 && typical > 0;

	return {
		load,
		typicalLoad: typical,
		// Above 100% is a harder run than your median; the ratio travels
		// better between athletes than either number does.
		vsTypicalPct: comparable ? (load / typical) * 100 : null,
		daysSinceAsHard: daysSinceAsHard(previous, load, date),
		runsCompared: previous.length,
	};
}

/** The week the run landed in, and how much of it this one run was. */
function weekImpact(weeks, run, date) {
	const week = (weeks || []).find((w) => w.start <= date && date <= addDays(w.start, 6));
	if (!week) {
		return null;
	}

	const distanceKm = number(run.distanceM) / 1000;
	const targetKm = finite(week.targetKm);

	return {
		start: week.start,
		actualKm: finite(week.actualKm),
		targetKm,
		// Against the target where there is one: "a third of the week" is a
		// statement about the plan, not about how much else got run.
		sharePct: targetKm > 0 ? (distanceKm / targetKm) * 100 : null,
	};
}

function paceOver(splits) {
	const distanceM = sum(splits.map((s) => s.distanceM));
	const timeSec = sum(splits.map((s) => s.timeSec));
	return distanceM > 0 ? timeSec / (distanceM / 1000) : null;
}

function fadeBetween(first, second) {
	if (!(first > 0) || !(second > 0)) {
		return null;
	}
	// Positive is a fade, negative a negative split — the way round every
	// coach says it, so the sign doesn't need explaining.
	return ((second - first) / first) * 100;
}

/** The fastest and slowest kilometre, of the ones that were a kilometre. */
function edges(list) {
	// The closing fragment stays in the halves, where it's weighted by its own
	// short distance, but it can't win fastest or slowest on a partial lap.
	const ranked = list
		.filter((s) => s.distanceM >= WHOLE_SPLIT_M)
		.sort((a, b) => a.paceSecPerKm - b.paceSecPerKm)
		.map((s) => ({ km: s.km, paceSecPerKm: s.paceSecPerKm }));

	return { fastest: ranked.at(0) ?? null, slowest: ranked.at(-1) ?? null };
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
	if (list.length < MIN_SPLITS_FOR_HALVES) {
		return null;
	}

	const half = Math.floor(list.length / 2);
	const firstHalfPaceSecPerKm = paceOver(list.slice(0, half));
	const secondHalfPaceSecPerKm = paceOver(list.slice(half));

	return {
		firstHalfPaceSecPerKm,
		secondHalfPaceSecPerKm,
		fadePct: fadeBetween(firstHalfPaceSecPerKm, secondHalfPaceSecPerKm),
		...edges(list),
	};
}

/** Seconds spent in the given zones, counting from zone 1. */
function secondsIn(zoneSeconds, ...zones) {
	return sum(zones.map((zone) => zoneSeconds.at(zone - 1)));
}

/** Time in zones 1–5 rolled up the way the intensity panel says it. */
function zoneMix(zoneSeconds) {
	if (!Array.isArray(zoneSeconds)) {
		return null;
	}
	const totalSec = sum(zoneSeconds);
	if (!(totalSec > 0)) {
		return null;
	}

	const easySec = secondsIn(zoneSeconds, 1, 2);
	const moderateSec = secondsIn(zoneSeconds, 3);
	const hardSec = secondsIn(zoneSeconds, 4, 5);

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
	if (!mix) {
		return classifyByPace(run.gapPaceSecPerKm, thresholds);
	}
	if (mix.hardPct >= HARD_SHARE_PCT) {
		return "hard";
	}
	return mix.moderatePct >= MODERATE_SHARE_PCT ? "moderate" : "easy";
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
	if (!run) {
		return null;
	}

	const date = toDayKey(run.startDateLocal);
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
			load: loadImpact(run, recentBefore(runs, date), date),
			week: weekImpact(weeks, run, date),
		},
	};
}
