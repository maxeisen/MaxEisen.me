// What the training does to the body, and what the body says back.
//
// recovery.js keeps sleep and overnight heart rate out of the fitness model on
// purpose, and that stands: CTL, ATL and form are averages of the same daily
// load, which is the only reason form is readable at all, and feeding a second
// source into part of that system is how form ends up permanently underwater
// (see fitness.js). Nothing here changes any of those numbers either. Every
// function in this module reads both sides and writes to neither.
//
// What it adds is the one thing neither panel could do alone: line the two up
// in time. Load measures the dose. Sleep, overnight heart rate and HRV measure
// the response. Kept in separate panels they each answer their own question
// perfectly well; read against each other by day they answer three the page
// couldn't ask before.
//
//   What did that run cost me?      The night after it, against my own normal.
//   What does a hard day cost me?   Every hard day of the block against every
//                                   easy one — a dose-response curve of one.
//   Is this fatigue from training?  Form is derived entirely from load, so it
//                                   can only ever tell you what you already
//                                   told it. Whether your body agrees is a
//                                   separate measurement, and the interesting
//                                   case is when it doesn't.
//
// The last is the one worth the code. A body that has stopped absorbing the
// work, or is coming down with something, is invisible to a training log and
// obvious in an overnight heart rate — and the same form of −28 means "this is
// landing, keep going" or "stop" depending entirely on which it is.
//
// The alignment throughout is that a night belongs to the day before it. Oura
// dates a night by the morning you wake into it, so the night after Tuesday's
// run is the record filed under Wednesday.

import { CHRONIC_DAYS, TSB_FATIGUE } from "./fitness.js";
import { addDays, toDayKey } from "./dates.js";
import { reading } from "./num.js";
import { HRV_DROP_PCT, RHR_RISE_BPM, windowMean } from "./recovery.js";
import { median, readingsOf } from "./stats.js";

// A hard day is one of the hardest third of the days you ran. That fraction
// puts the long run and the week's quality session on one side and the easy
// days on the other, which is the split a runner would make by hand.
const HARD_DAY_DIVISOR = 3;

// Below this many nights on either side, the medians are describing which
// nights happened to be recorded rather than what a hard day costs, so nothing
// is reported at all. Deliberately the same instinct as the run log's "not
// enough runs to compare" gate.
const MIN_NIGHTS_PER_GROUP = 4;

// How many nights to follow a hard day before giving up on the heart rate
// coming back down. Four, because past that the next hard day has usually
// happened and the question stops being answerable.
const RECOVERY_CAP_NIGHTS = 4;

// How far back the dose-response profile looks. Six weeks is the stored
// recovery window less a few days, and about as far back as a block's easy
// days and hard days are still the same easy days and hard days.
const PROFILE_DAYS = 42;

// Skin temperature this far above your own normal is Oura's own "something is
// coming" signal. It never triggers anything here — a warm bedroom does this
// too — but when the heart rate has already raised its hand, it's the piece of
// evidence that says which kind of tired this is.
export const TEMP_RISE_C = 0.5;

const finite = (value) => (Number.isFinite(reading(value)) ? reading(value) : null);

/**
 * The night that followed a day, if the ring recorded one.
 *
 * @param {object[]} records shaped nights.
 * @param {string} day day key of the training day.
 * @returns {object|null}
 */
export function nightAfter(records, day) {
	const morning = addDays(toDayKey(day), 1);
	if (!morning) {
		return null;
	}
	return (records || []).find((record) => record?.day === morning) || null;
}

/**
 * One measure of one night against the month before it.
 *
 * The baseline stops the day before the night itself, so a night is never
 * compared against an average it is part of — with 28 nights that's a small
 * effect, but a bad night dragging down the baseline it's measured against is
 * the kind of quiet self-cancelling that makes a number useless exactly when
 * it matters.
 */
function against(records, night, field, before) {
	const value = reading(night?.[field]);
	if (!Number.isFinite(value)) {
		return null;
	}
	const { mean } = windowMean(records, field, { to: before, days: CHRONIC_DAYS });
	const baseline = Number.isFinite(mean) ? mean : null;
	const delta = baseline === null ? null : value - baseline;
	return {
		value,
		baseline,
		delta,
		deltaPct: delta !== null && baseline > 0 ? (delta / baseline) * 100 : null,
	};
}

/** One night, read against the month that preceded it. */
function readNight(records, night) {
	if (!night) {
		return null;
	}
	// The baseline stops the day before, so a night is never compared against
	// an average it's part of.
	const before = addDays(night.day, -1);
	return {
		day: night.day,
		sleep: against(records, night, "sleepSec", before),
		restingHr: against(records, night, "restingHr", before),
		hrv: against(records, night, "averageHrv", before),
		temperatureDeviationC: finite(night.temperatureDeviationC),
	};
}

/**
 * The night after a training day, read against that athlete's own normal.
 *
 * @param {object[]} records shaped nights.
 * @param {string} day day key of the training day.
 * @returns {object|null} null when the ring has nothing for that morning —
 *   the usual case for a run you did this morning, and the reason this is
 *   reported as an addition to a run rather than part of it.
 */
export function nightAfterDay(records, day) {
	return readNight(records, nightAfter(records, day));
}

/**
 * The night a training day started from.
 *
 * The other half of the same question, and the half that's always available:
 * the night after this morning's run hasn't happened yet, but the one you took
 * into it has. What it answers is different enough to be worth saying — not
 * what the run cost, but what you had to spend.
 *
 * @param {object[]} records shaped nights.
 * @param {string} day day key of the training day.
 * @returns {object|null}
 */
export function nightBeforeDay(records, day) {
	const morning = toDayKey(day);
	return readNight(records, (records || []).find((record) => record?.day === morning) || null);
}

/**
 * The hardest third of the days you ran, by rank rather than by a load above
 * some threshold.
 *
 * The threshold version is the obvious one and it doesn't work: most easy days
 * in a block carry nearly the same load, so a cut taken at the two-thirds mark
 * lands on that value, every day is then at or above it, and a comparison
 * meant to isolate the hard days quietly compares all of them against nothing.
 * Ranking can't degenerate that way. Rest days aren't in the running at all —
 * a day off is not a soft version of a hard day.
 */
function hardestThird(days) {
	const ran = days.filter((day) => reading(day.load) > 0);
	const count = Math.floor(ran.length / HARD_DAY_DIVISOR);
	if (count === 0) {
		return null;
	}
	const ranked = [...ran].sort(
		(a, b) => reading(b.load) - reading(a.load) || String(a.date).localeCompare(String(b.date)),
	);
	return new Set(ranked.slice(0, count).map((day) => day.date));
}

/** Split the nights of a window by how hard the day before them was. */
function groupNights(records, days, hardDays) {
	const hard = [];
	const easy = [];
	for (const day of days) {
		const night = nightAfter(records, day.date);
		if (night) {
			const list = hardDays.has(day.date) ? hard : easy;
			list.push({ ...night, after: day.date });
		}
	}
	return { hard, easy };
}

function summarise(nights) {
	return {
		nights: nights.length,
		sleepSec: median(readingsOf(nights, "sleepSec")),
		restingHr: median(readingsOf(nights, "restingHr")),
		averageHrv: median(readingsOf(nights, "averageHrv")),
	};
}

const difference = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? a - b : null);

/**
 * How many nights after a day before the overnight heart rate is back down to
 * `target`.
 *
 * @param {object[]} records shaped nights.
 * @param {string} date day key of the training day.
 * @param {number} target the heart rate to come back to.
 * @returns {number|null} 1 when the very next night is already there,
 *   RECOVERY_CAP_NIGHTS + 1 for "still up four nights later", and null when
 *   the ring recorded nothing across the window to judge it by.
 */
export function nightsUntilBackTo(records, date, target) {
	let recorded = 0;
	for (let n = 1; n <= RECOVERY_CAP_NIGHTS; n++) {
		const hr = reading(nightAfter(records, addDays(date, n - 1))?.restingHr);
		if (Number.isFinite(hr)) {
			recorded += 1;
			if (hr <= target) {
				return n;
			}
		}
	}
	return recorded > 0 ? RECOVERY_CAP_NIGHTS + 1 : null;
}

function nightsToBaseline(records, hard, target) {
	if (!(target > 0)) {
		return null;
	}
	const counts = hard
		.map((night) => nightsUntilBackTo(records, night.after, target))
		.filter((count) => count !== null);
	return counts.length >= MIN_NIGHTS_PER_GROUP ? median(counts) : null;
}

/**
 * What a hard day costs, measured on this athlete rather than assumed.
 *
 * Two groups of nights — the ones after the block's hardest days and the ones
 * after everything else, rest days included — compared on their medians. The
 * comparison is deliberately crude in one respect: it makes no attempt to
 * separate the run from the day around it, so a Saturday long run gets credit
 * for a Saturday night out. Over six weeks that mostly averages out, and the
 * honest framing is descriptive anyway. This is what your nights after hard
 * days have looked like, not proof of what caused them.
 *
 * @param {object} input
 * @param {object[]} input.records shaped nights.
 * @param {object[]} input.series fitness series, for daily load.
 * @param {string} input.today day key.
 * @param {number} [input.days] window length.
 * @returns {object|null} null until there are enough nights on both sides.
 */
export function overnightCost({ records = [], series = [], today, days = PROFILE_DAYS }) {
	const day = toDayKey(today);
	const from = addDays(day, -(days - 1));
	// Today is excluded: its night hasn't happened yet, and a day with no
	// night after it says nothing either way.
	const window = (series || []).filter((d) => d?.date >= from && d?.date < day);
	const hardDays = hardestThird(window);
	if (!hardDays) {
		return null;
	}

	const { hard, easy } = groupNights(records, window, hardDays);
	if (hard.length < MIN_NIGHTS_PER_GROUP || easy.length < MIN_NIGHTS_PER_GROUP) {
		return null;
	}

	const afterHard = summarise(hard);
	const afterEasy = summarise(easy);
	return {
		afterHard,
		afterEasy,
		sleepDeltaSec: difference(afterHard.sleepSec, afterEasy.sleepSec),
		restingHrDelta: difference(afterHard.restingHr, afterEasy.restingHr),
		hrvDelta: difference(afterHard.averageHrv, afterEasy.averageHrv),
		// Counted in nights rather than days, and capped: past four the next
		// hard day has usually landed and the question can't be answered.
		nightsToBaseline: nightsToBaseline(records, hard, afterEasy.restingHr),
		cappedAt: RECOVERY_CAP_NIGHTS,
	};
}

function stressedBy(recovery) {
	const restingHr = recovery?.restingHr || {};
	const hrv = recovery?.hrv || {};
	const temperature = finite(recovery?.latest?.temperatureDeviationC);
	return {
		restingHrUp: Number.isFinite(restingHr.delta) && restingHr.delta >= RHR_RISE_BPM,
		hrvDown: Number.isFinite(hrv.deltaPct) && hrv.deltaPct <= -HRV_DROP_PCT,
		temperatureUp: temperature !== null && temperature >= TEMP_RISE_C,
		temperatureDeviationC: temperature,
	};
}

function stateOf(heavy, stressed) {
	if (heavy) {
		return stressed ? "buried" : "absorbing";
	}
	return stressed ? "unexplained" : "clear";
}

/**
 * Whether the body agrees with the training log about how tired you are.
 *
 * Four cases, of which two are worth a sentence:
 *
 *   buried       Form is deep and the markers agree. Expected after a big
 *                block; a problem if it doesn't lift.
 *   absorbing    Form is deep and the body is at baseline. The load is
 *                landing. Form alone would have told you to back off.
 *   unexplained  Form is fine and the body isn't. Whatever this is, you
 *                didn't run it — and it's the one case a training log can
 *                never show you.
 *   clear        Neither. Nothing to say.
 *
 * @param {object} input
 * @param {number|null} input.tsb form, from the fitness series.
 * @param {object|null} input.recovery the recovery summary.
 * @returns {object|null} null without recovery data, so callers can leave the
 *   subject alone rather than assert everything is fine.
 */
export function strainSignal({ tsb = null, recovery = null }) {
	if (!recovery) {
		return null;
	}
	const markers = stressedBy(recovery);
	const stressed = markers.restingHrUp || markers.hrvDown;
	const heavy = Number.isFinite(tsb) && tsb <= TSB_FATIGUE;
	return {
		state: stateOf(heavy, stressed),
		tsb: Number.isFinite(tsb) ? tsb : null,
		formThreshold: TSB_FATIGUE,
		...markers,
	};
}
