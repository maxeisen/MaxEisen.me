// A short title and a plain-language summary of what kind of run this was.
//
// The caption's numbers say what a run did to fitness and form. This says
// what the run was: "8 × 400m Repeats", or "6km Easy Run, kept easy". Two
// sources feed it:
//
//   The plan   the session the run was matched to (see matchRunsToPlan),
//              including one moved by a day. Its name is what the athlete
//              scheduled, so it's the title whenever there is one. When
//              Runna's description gave the reps and their pace, those come
//              along as the session's `target`.
//   The run    its laps, splits, climbing and heart-rate zones. Laps are the
//              best record of a structured workout: per-kilometre splits
//              smear a 400 m rep across two kilometres. They come from the
//              detailed activity the caption already reads, and are never
//              stored. When the laps are plain 1 km auto-laps, the stored
//              pace trace (a sample about every 150 m) is read instead: too
//              coarse to measure a 400 m rep, but enough to count reps and
//              average their pace.
//
// Everything here is a pure function of those inputs.

import { clock, previousOfKind } from "./caption.js";
import { isRunActivity } from "./shape.js";
import { median } from "./stats.js";
import { zoneMix } from "./zones.js";

// Laps shorter than this are a button pressed twice, not part of the workout.
const MIN_LAP_M = 100;
const MIN_LAP_SEC = 20;
// How big the jump in pace between the fast laps and the slow laps must be
// before they read as reps and recoveries, rather than one run with some
// variation in it. 1.12 means the slow group is at least 12% slower.
const REP_PACE_GAP = 1.12;
// Slower than this is walking or standing, not running. Those laps are always
// rest. Left in, a walk is so much slower than the warm-up that the biggest
// jump in pace falls between running and walking, and the warm-up and
// cool-down get counted as reps.
const WALK_PACE_SEC_PER_KM = 9 * 60;
// A rest this many times the usual one separates two sets of reps.
const SET_REST_FACTOR = 1.8;
// Laps all within this of one length (bar the last) are the watch's
// auto-laps, every 1 km or mile. They say nothing about a workout's shape,
// and a hilly kilometre among them can look like a rest.
const AUTO_LAP_SPREAD = 0.05;
// Reading reps from the pace trace. A sample this much faster than the run's
// median running pace is part of a rep. Stretches of a single sample are
// noise (a downhill, a GPS jump) and are dropped, and the rest must be about
// the same length, at least TRACE_MIN_REPS of them, before they read as reps.
const TRACE_FAST = 0.85;
const TRACE_MIN_POINTS = 20;
const TRACE_MIN_REPS = 3;
const TRACE_MAX_SPREAD = 2;
// A single fast block (no reps) has to be at least this long to be a tempo
// effort rather than one quick kilometre.
const MIN_TEMPO_BLOCK_M = 2000;
// Reps within this of each other are "the same" for "8 × 400m".
const SAME_REP = 0.1;
// Last third this much faster than the first third reads as progressive.
const PROGRESSIVE_SEC_PER_KM = 10;
const MIN_PROGRESSIVE_SPLITS = 6;
// Climbing per kilometre that makes a run hilly.
const HILLY_M_PER_KM = 15;
// Share of time in zones 1–2 that makes a run easy, and the share below which
// a planned easy run was run harder than planned.
const EASY_PCT = 75;
const TOO_HARD_PCT = 60;
// A run this much longer than the recent median reads as a long run.
const LONG_RUN_FACTOR = 1.4;
const LONG_RUN_MIN_KM = 10;
// Distance off the plan by more than this is worth saying.
const DISTANCE_OFF_PLAN = 0.15;

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Strava's own titles for a run nobody named. Only these are replaced: a
// title the athlete wrote is theirs.
const DEFAULT_TITLE_RE = /^(?:Morning|Lunch|Afternoon|Evening|Night)(?: Trail| Treadmill| Virtual)? Run$/i;

export function isDefaultTitle(name) {
	return DEFAULT_TITLE_RE.test(String(name || "").trim());
}

function weekdayOf(dayKey) {
	const [y, m, d] = String(dayKey).split("-").map(Number);
	const date = new Date(Date.UTC(y, m - 1, d));
	return Number.isNaN(date.getTime()) ? null : WEEKDAYS[(date.getUTCDay() + 6) % 7];
}

const pace = (secPerKm) => (secPerKm > 0 ? `${clock(secPerKm)}/km` : null);

/** "7.6km", "6km": one decimal, without a trailing ".0", Runna's style. */
export function kmLabel(metres) {
	const km = Math.round((Number(metres) || 0) / 100) / 10;
	return `${km}km`;
}

/** A rep distance as people say it: "400m", "1km", "1.6km". */
function repDistance(metres) {
	if (metres < 1000) return `${Math.round(metres / 50) * 50}m`;
	return kmLabel(metres);
}

/**
 * The parts of Strava's laps this reads. Nothing positional is kept.
 *
 * @param {object[]} [laps] DetailedActivity.laps.
 * @returns {{distanceM: number, movingTimeSec: number, elapsedTimeSec: number}[]}
 */
export function shapeLaps(laps) {
	return (Array.isArray(laps) ? laps : [])
		.map((lap) => ({
			distanceM: Number(lap?.distance) || 0,
			movingTimeSec: Number(lap?.moving_time) || 0,
			elapsedTimeSec: Number(lap?.elapsed_time) || Number(lap?.moving_time) || 0,
		}))
		// A standing rest is a lap with no distance, and it still separates
		// two reps, so only empty laps are dropped.
		.filter((lap) => lap.elapsedTimeSec > 0);
}

/**
 * The fast blocks of a structured workout, read from its laps.
 *
 * Laps are split into a fast group and a slow group at the biggest jump in
 * pace between them. Only a clear jump counts, so evenly paced auto-laps
 * (every kilometre the same) come back as no workout. Fast laps next to each
 * other are one block.
 *
 * @param {object[]} laps from shapeLaps().
 * @returns {{blocks: {distanceM: number, movingTimeSec: number}[],
 *   label: string, paceSecPerKm: number, recoverySec: number|null}|null}
 */
export function detectReps(laps) {
	const all = (laps || []).map((lap, i) => ({
		...lap,
		i,
		pace: lap.distanceM > 0 && lap.movingTimeSec > 0 ? lap.movingTimeSec / (lap.distanceM / 1000) : null,
	}));
	// Short laps and walking laps take no part in deciding what fast is, but
	// they still count as the rest between reps.
	const usable = all.filter(
		(lap) => lap.distanceM >= MIN_LAP_M && lap.movingTimeSec >= MIN_LAP_SEC && lap.pace < WALK_PACE_SEC_PER_KM,
	);
	if (usable.length < 3 || isAutoLaps(all)) return null;

	const sorted = [...usable].sort((a, b) => a.pace - b.pace);
	let split = 0;
	let widest = 0;
	for (let k = 1; k < sorted.length; k++) {
		const jump = sorted[k].pace / sorted[k - 1].pace;
		if (jump > widest) {
			widest = jump;
			split = k;
		}
	}
	if (widest < REP_PACE_GAP) return null;
	const fast = new Set(sorted.slice(0, split).map((lap) => lap.i));

	// Fast laps next to each other are one block; the slow laps between
	// blocks are the recoveries.
	const blocks = [];
	const recoveries = [];
	let current = null;
	let gap = null;
	for (const lap of all) {
		if (fast.has(lap.i)) {
			if (gap !== null && blocks.length > 0) recoveries.push(gap);
			gap = null;
			if (!current) {
				current = { distanceM: 0, movingTimeSec: 0 };
				blocks.push(current);
			}
			current.distanceM += lap.distanceM;
			current.movingTimeSec += lap.movingTimeSec;
		} else {
			current = null;
			gap = (gap ?? 0) + lap.elapsedTimeSec;
		}
	}

	// One block is only a workout when it's a real stretch of running with
	// easier running either side of it, not a fast finish.
	if (blocks.length === 1) {
		const firstFast = all.findIndex((lap) => fast.has(lap.i));
		const lastFast = all.findLastIndex((lap) => fast.has(lap.i));
		const surrounded = firstFast > 0 && lastFast < all.length - 1;
		if (!surrounded || blocks[0].distanceM < MIN_TEMPO_BLOCK_M) return null;
	}

	const distanceM = blocks.reduce((sum, b) => sum + b.distanceM, 0);
	const movingTimeSec = blocks.reduce((sum, b) => sum + b.movingTimeSec, 0);
	const sets = repSets(blocks.length, recoveries);
	return {
		blocks,
		label: repsLabel(blocks),
		sets,
		paceSecPerKm: movingTimeSec / (distanceM / 1000),
		// The usual rest between reps, leaving out the longer rests between sets.
		recoverySec: recoveries.length ? median(sets ? recoveries.filter((r, i) => !sets.breaks.has(i)) : recoveries) : null,
	};
}

// Two sets of five: the rests between reps are all about the same, except one
// (or more) clearly longer that splits the reps into equal groups.
function repSets(count, recoveries) {
	if (recoveries.length < 3) return null;
	const usual = median(recoveries);
	const breaks = new Set(recoveries.map((r, i) => (r >= usual * SET_REST_FACTOR ? i : -1)).filter((i) => i >= 0));
	if (breaks.size === 0 || breaks.size === recoveries.length) return null;
	const sets = breaks.size + 1;
	const perSet = count / sets;
	if (!Number.isInteger(perSet) || perSet < 2) return null;
	// Rest i sits after rep i + 1, so set boundaries fall after every perSet reps.
	for (const i of breaks) if ((i + 1) % perSet !== 0) return null;
	return { count: sets, perSet, breaks };
}

function isAutoLaps(laps) {
	const whole = laps.slice(0, -1).map((lap) => lap.distanceM);
	if (whole.length < 2) return false;
	const typical = median(whole);
	return typical > 0 && whole.every((d) => Math.abs(d - typical) <= typical * AUTO_LAP_SPREAD);
}

/**
 * Reps counted from the stored pace trace, for when the laps don't show them.
 *
 * The trace can count reps and average their pace, but its samples are too
 * far apart to measure a rep's length, so the distance comes from the plan
 * when it gives one ("400m Repeats").
 *
 * @param {{pace?: number[]}} trace the record's trace.
 * @param {number|null} [planDistanceM] the rep distance the plan names.
 * @returns {object|null} shaped like detectReps(), with `fromTrace: true`
 *   and no rest time.
 */
export function traceReps(trace, planDistanceM = null) {
	const paces = Array.isArray(trace?.pace) ? trace.pace : [];
	if (paces.length < TRACE_MIN_POINTS) return null;
	const running = paces.filter((p) => p > 0 && p < WALK_PACE_SEC_PER_KM);
	if (running.length < TRACE_MIN_POINTS) return null;
	const cut = median(running) * TRACE_FAST;

	const stretches = [];
	let current = null;
	for (const p of paces) {
		if (p > 0 && p <= cut) {
			if (!current) {
				current = [];
				stretches.push(current);
			}
			current.push(p);
		} else {
			current = null;
		}
	}
	const reps = stretches.filter((s) => s.length > 1);
	if (reps.length < TRACE_MIN_REPS) return null;
	const sizes = reps.map((s) => s.length);
	if (Math.max(...sizes) > Math.min(...sizes) * TRACE_MAX_SPREAD) return null;

	// Every sample covers the same distance, so the plain mean of the paces
	// is the average pace over them.
	const samples = reps.flat();
	const distanceM = planDistanceM > 0 ? planDistanceM : null;
	return {
		blocks: reps.map(() => ({ distanceM })),
		label: distanceM ? `${reps.length} × ${repDistance(distanceM)}` : `${reps.length} reps`,
		sets: null,
		paceSecPerKm: samples.reduce((sum, p) => sum + p, 0) / samples.length,
		recoverySec: null,
		fromTrace: true,
	};
}

// The rep distance a planned interval session names: its target's, or a
// distance in its name ("400m Repeats", "1km Repeats").
function planRepDistance(match) {
	if (!match?.planned || match.type !== "intervals") return null;
	if (match.target?.distanceM > 0) return match.target.distanceM;
	const m = /(\d+(?:\.\d+)?)\s?(m|km)\b/i.exec(String(match.detail || ""));
	return m ? Number(m[1]) * (m[2].toLowerCase() === "km" ? 1000 : 1) : null;
}

// "8 × 400m" when the reps match by distance, "6 × 3 min" when they match by
// time instead, otherwise the blocks in order: "2km, 1km, 1km".
function repsLabel(blocks) {
	const same = (values) => {
		const mid = median(values);
		return mid > 0 && values.every((v) => Math.abs(v - mid) <= mid * SAME_REP) ? mid : null;
	};
	if (blocks.length === 1) return repDistance(blocks[0].distanceM);
	const byDistance = same(blocks.map((b) => b.distanceM));
	if (byDistance) return `${blocks.length} × ${repDistance(byDistance)}`;
	const byTime = same(blocks.map((b) => b.movingTimeSec));
	if (byTime) return `${blocks.length} × ${Math.round(byTime / 60)} min`;
	return blocks.map((b) => repDistance(b.distanceM)).join(", ");
}

/**
 * How much faster the last third of the run was than the first, by
 * grade-adjusted pace where there is one, in seconds per km. Positive is
 * faster. Null on a run too short to have thirds.
 *
 * @param {object[]} splits shaped per-km splits.
 * @returns {number|null}
 */
export function progression(splits) {
	const full = (splits || []).filter((s) => s.distanceM >= 900 && (s.gapPaceSecPerKm > 0 || s.paceSecPerKm > 0));
	if (full.length < MIN_PROGRESSIVE_SPLITS) return null;
	const third = Math.floor(full.length / 3);
	const avg = (list) => list.reduce((sum, s) => sum + (s.gapPaceSecPerKm || s.paceSecPerKm), 0) / list.length;
	return avg(full.slice(0, third)) - avg(full.slice(-third));
}

// The kind of run when there's no plan to say so.
function unplannedKind(run, reps, { recentMedianM, progressionSec }) {
	if (Number(run?.workoutType) === 1) return "race";
	if (reps) return reps.blocks.length === 1 ? "tempo" : "intervals";
	const km = (Number(run?.distanceM) || 0) / 1000;
	const long =
		Number(run?.workoutType) === 2 ||
		(km >= LONG_RUN_MIN_KM && recentMedianM > 0 && run.distanceM >= recentMedianM * LONG_RUN_FACTOR);
	if (long) return "long run";
	if (progressionSec >= PROGRESSIVE_SEC_PER_KM) return "progressive";
	return "easy run";
}

const KIND_NAMES = {
	"easy run": "Easy Run",
	"long run": "Long Run",
	progressive: "Progressive Run",
	tempo: "Tempo",
	intervals: "Intervals",
	race: "Race",
};

// The same kinds as they read in a sentence.
const KIND_PHRASES = {
	"easy run": "an easy run",
	"long run": "a long run",
	progressive: "a progressive run",
	tempo: "a tempo run",
	intervals: "an interval session",
	race: "a race",
};

// The plan's name for the session, minus Runna's "(~55m)" time estimate, with
// its leading distance swapped for the distance actually run.
function plannedTitle(match, run, reps) {
	let title = String(match.detail || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
	if (!title) title = KIND_NAMES[match.type] || "Run";
	title = title.replace(/^\d+(?:\.\d+)?\s?km\b/i, kmLabel(run.distanceM));
	// "400m Repeats" becomes "8 × 400m Repeats" when the laps show eight, or,
	// with no reps in the laps, when the plan asked for eight.
	let count = reps && reps.blocks.length > 1 ? /^(\d+) × (.+)$/.exec(reps.label) : null;
	if (!reps && match.target) count = [null, String(match.target.reps), repDistance(match.target.distanceM)];
	if (count && !/\d+\s*[x×]/i.test(title) && title.includes(count[2])) {
		title = `${count[1]} × ${title}`;
	}
	return title;
}

function unplannedTitle(kind, run, reps, hilly) {
	if (kind === "intervals" && reps?.fromTrace && !/×/.test(reps.label)) return `${kmLabel(run.distanceM)} Intervals`;
	if (kind === "intervals" && reps) return `${reps.label} ${/×/.test(reps.label) ? "Repeats" : "Intervals"}`;
	if (kind === "tempo" && reps) return `${reps.label} Tempo`;
	if (kind === "race") return `${kmLabel(run.distanceM)} Race`;
	return `${kmLabel(run.distanceM)} ${hilly ? "Hilly " : ""}${KIND_NAMES[kind]}`;
}

// "8 × 400m at 3:35/km", or with a range "5 × 1km at 4:10–4:20/km".
function targetLabel(target) {
	if (!target?.reps || !target.distanceM) return null;
	const [fast, slow] = target.paceSecPerKm || [];
	const range = fast > 0 && slow > fast ? `${clock(fast)}–${pace(slow)}` : pace(fast);
	return `${target.reps} × ${repDistance(target.distanceM)}${range ? ` at ${range}` : ""}`;
}

/**
 * The title and summary for one run.
 *
 * @param {object} run a stored, shaped run.
 * @param {object} [context]
 * @param {object|null} [context.match] from matchRunsToPlan().
 * @param {object[]} [context.laps] from shapeLaps().
 * @param {object[]} [context.runs] every stored run, for what's normal lately.
 * @returns {{kind: string, title: string, summary: string}}
 */
export function describeRun(run, { match = null, laps = [], runs = [] } = {}) {
	const planned = match?.planned === true;
	const reps = detectReps(laps) ?? traceReps(run?.trace, planRepDistance(match));
	const km = (Number(run?.distanceM) || 0) / 1000;
	const climbM = Number(run?.elevationGainM) || 0;
	const hilly = km > 0 && climbM / km >= HILLY_M_PER_KM;
	const progressionSec = progression(run?.splits);
	const mix = zoneMix(run?.zoneSeconds);
	const recent = previousOfKind(run, runs, isRunActivity).map((r) => Number(r.distanceM) || 0);
	const recentMedianM = recent.length >= 3 ? median(recent) : null;

	const kind = planned ? match.type || "easy run" : unplannedKind(run, reps, { recentMedianM, progressionSec });
	const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
	const title = capital(planned ? plannedTitle(match, run, reps) : unplannedTitle(kind, run, reps, hilly));
	// The session's name from the plan alone, with no rep count: a title
	// that's only this was taken from the plan, so a better one may replace it.
	const planName = planned ? capital(plannedTitle({ ...match, target: null }, run, null)) : null;

	const sentences = [];
	if (planned) {
		const plannedKm = Number(match.distanceKm) > 0 ? ` (${match.distanceKm} km)` : "";
		const name = String(match.detail || KIND_NAMES[match.type] || "run").replace(/\s*\([^)]*\)\s*$/, "");
		const moved = match.movedFrom ? `, moved from ${weekdayOf(match.movedFrom)}` : "";
		const asked = targetLabel(match.target);
		sentences.push(`Planned session: ${name}${plannedKm}${moved}${asked ? `, ${asked}` : ""}.`);
		const off = Number(match.distanceKm) > 0 ? km / match.distanceKm - 1 : 0;
		if (Math.abs(off) > DISTANCE_OFF_PLAN) {
			sentences.push(`Ran ${km.toFixed(1)} km, ${off > 0 ? "more" : "less"} than the ${match.distanceKm} km planned.`);
		}
	} else {
		sentences.push(`Not on the plan: ${KIND_PHRASES[kind]}.`);
	}

	if (reps) {
		const recovery = reps.recoverySec > 0 ? `, with about ${clock(reps.recoverySec)} between reps` : "";
		const inSets = reps.sets ? ` in ${reps.sets.count} sets of ${reps.sets.perSet}` : "";
		const named = reps.blocks.length === 1 || reps.fromTrace || /×/.test(reps.label);
		const what = `${reps.label}${named ? "" : " reps"}${inSets}`;
		// The trace's samples straddle the start and end of each rep, so its
		// average is close but not exact.
		const about = reps.fromTrace ? "about " : "";
		sentences.push(`${what.charAt(0).toUpperCase()}${what.slice(1)} at an average of ${about}${pace(reps.paceSecPerKm)}${recovery}.`);
	} else if (progressionSec >= PROGRESSIVE_SEC_PER_KM) {
		sentences.push(`Picked up through the run: the last third was ${Math.round(progressionSec)} s/km faster than the first.`);
	}

	if (hilly) sentences.push(`Hilly, with ${Math.round(climbM)} m of climbing.`);

	if (mix && !reps) {
		const easyPct = Math.round(mix.easyPct);
		if (kind === "easy run" && mix.easyPct < TOO_HARD_PCT) {
			sentences.push(`Harder than an easy run: only ${easyPct}% of the time in the easy heart-rate zones.`);
		} else if (mix.easyPct >= EASY_PCT && kind !== "race") {
			sentences.push(`Kept easy: ${easyPct}% of the time in the easy heart-rate zones.`);
		}
	}

	return { kind, title, planName, summary: sentences.join(" ") };
}

/**
 * The new Strava title for a run, or null to leave the current one alone.
 *
 * A title is only replaced when it's Strava's default, or one of `replaceable`:
 * the title this code wrote last time, or the plan's bare name for the
 * session. Anything else was written by the athlete and is kept.
 *
 * @param {string} currentName the title on Strava now.
 * @param {string} title from describeRun().
 * @param {(string|null)[]} [replaceable]
 * @returns {string|null}
 */
export function retitle(currentName, title, replaceable = []) {
	if (!title) return null;
	const current = String(currentName || "").trim();
	if (!isDefaultTitle(current) && !replaceable.includes(current)) return null;
	return title === current ? null : title;
}
