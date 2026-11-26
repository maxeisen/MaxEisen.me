// A short title and a plain-language summary of what kind of run this was.
//
// The caption's numbers say what a run did to fitness and form. This says
// what the run was: "8 × 400m Repeats", or "6km Easy Run, kept easy". Two
// sources feed it:
//
//   The plan   the session the run was matched to (see matchRunsToPlan),
//              including one moved by a day. Its name is what the athlete
//              scheduled, so it's the title whenever there is one.
//   The run    its laps, splits, climbing and heart-rate zones. Laps are the
//              only place a structured workout shows up: per-kilometre splits
//              smear a 400 m rep across two kilometres. They come from the
//              detailed activity the caption already reads, and are never
//              stored.
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
	// Short laps take no part in deciding what fast is, but they still count
	// as the easy running between reps.
	const usable = all.filter((lap) => lap.distanceM >= MIN_LAP_M && lap.movingTimeSec >= MIN_LAP_SEC);
	if (usable.length < 3) return null;

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
	return {
		blocks,
		label: repsLabel(blocks),
		paceSecPerKm: movingTimeSec / (distanceM / 1000),
		recoverySec: recoveries.length ? median(recoveries) : null,
	};
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
	// "400m Repeats" becomes "8 × 400m Repeats" when the laps show eight.
	const count = reps && reps.blocks.length > 1 ? /^(\d+) × (.+)$/.exec(reps.label) : null;
	if (count && !/\d+\s*[x×]/i.test(title) && title.includes(count[2])) {
		title = `${count[1]} × ${title}`;
	}
	return title;
}

function unplannedTitle(kind, run, reps, hilly) {
	if (kind === "intervals" && reps) return `${reps.label} ${/×/.test(reps.label) ? "Repeats" : "Intervals"}`;
	if (kind === "tempo" && reps) return `${reps.label} Tempo`;
	if (kind === "race") return `${kmLabel(run.distanceM)} Race`;
	return `${kmLabel(run.distanceM)} ${hilly ? "Hilly " : ""}${KIND_NAMES[kind]}`;
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
	const reps = detectReps(laps);
	const km = (Number(run?.distanceM) || 0) / 1000;
	const climbM = Number(run?.elevationGainM) || 0;
	const hilly = km > 0 && climbM / km >= HILLY_M_PER_KM;
	const progressionSec = progression(run?.splits);
	const mix = zoneMix(run?.zoneSeconds);
	const recent = previousOfKind(run, runs, isRunActivity).map((r) => Number(r.distanceM) || 0);
	const recentMedianM = recent.length >= 3 ? median(recent) : null;

	const kind = planned ? match.type || "easy run" : unplannedKind(run, reps, { recentMedianM, progressionSec });
	const named = planned ? plannedTitle(match, run, reps) : unplannedTitle(kind, run, reps, hilly);
	const title = named.charAt(0).toUpperCase() + named.slice(1);

	const sentences = [];
	if (planned) {
		const plannedKm = Number(match.distanceKm) > 0 ? ` (${match.distanceKm} km)` : "";
		const name = String(match.detail || KIND_NAMES[match.type] || "run").replace(/\s*\([^)]*\)\s*$/, "");
		const moved = match.movedFrom ? `, moved from ${weekdayOf(match.movedFrom)}` : "";
		sentences.push(`Planned session: ${name}${plannedKm}${moved}.`);
		const off = Number(match.distanceKm) > 0 ? km / match.distanceKm - 1 : 0;
		if (Math.abs(off) > DISTANCE_OFF_PLAN) {
			sentences.push(`Ran ${km.toFixed(1)} km, ${off > 0 ? "more" : "less"} than the ${match.distanceKm} km planned.`);
		}
	} else {
		sentences.push(`Not on the plan: ${KIND_PHRASES[kind]}.`);
	}

	if (reps) {
		const recovery = reps.recoverySec > 0 ? `, with about ${clock(reps.recoverySec)} between reps` : "";
		const what = reps.blocks.length === 1 ? reps.label : `${reps.label}${/×/.test(reps.label) ? "" : " reps"}`;
		sentences.push(`${what.charAt(0).toUpperCase()}${what.slice(1)} at an average of ${pace(reps.paceSecPerKm)}${recovery}.`);
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

	return { kind, title, summary: sentences.join(" ") };
}

/**
 * The new Strava title for a run, or null to leave the current one alone.
 *
 * @param {string} currentName the title on Strava now.
 * @param {string} title from describeRun().
 * @returns {string|null}
 */
export function retitle(currentName, title) {
	if (!title || !isDefaultTitle(currentName)) return null;
	return title === currentName ? null : title;
}
