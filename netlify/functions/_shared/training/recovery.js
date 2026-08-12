// Sleep and overnight heart rate, from the Oura ring.
//
// This is the one part of the dashboard fed by something other than training
// load, and it is deliberately kept beside the fitness model rather than wired
// into it. CTL, ATL and form are a closed system: both traces are averages of
// the same daily load, which is what makes them converge and what makes form
// readable at all (see fitness.js). Feeding a second source into part of that
// system is exactly how rides put form permanently underwater. Recovery data
// therefore has its own panel and its own recommendation rules, and touches no
// existing number.
//
// What it's for is the thing training load genuinely can't see. Load says how
// much work you did; it has no idea whether you slept five hours or nine
// afterwards, and the same week of running is a different proposition depending
// on the answer. Chronic short sleep is one of the better-evidenced injury risk
// factors in athletes, and overnight resting heart rate is a long-standing
// marker of illness and accumulated overreaching — both measured while asleep,
// which is why a ring reads them better than a watch ever did.
//
// The windows are 7 days against 28, matching ACWR exactly. That's not a
// coincidence worth hiding: the page already explains acute-versus-chronic in
// those terms, and reusing the shape means "recent against established" means
// the same thing everywhere.

import { ACUTE_DAYS, CHRONIC_DAYS } from "./fitness.js";
import { reading } from "./num.js";
import { addDays, eachDay, toDayKey } from "./dates.js";

// The night, as opposed to an afternoon nap. Oura types a main sleep period as
// `long_sleep` once it passes three hours; `sleep` covers shorter main periods.
// Naps and rest periods are excluded on purpose: a nap's lowest heart rate is
// not your overnight resting rate, and counting one towards the night's total
// would say you slept well when you slept twice.
const MAIN_SLEEP_TYPES = new Set(["long_sleep", "sleep"]);

// Sleep below this, sustained, is where the injury-risk association starts to
// show up. Held as a nightly average rather than a single bad night, because
// one short night is life and nine of them is a pattern.
export const SLEEP_TARGET_SEC = 7 * 3600;

// Overnight resting heart rate this far above baseline suggests something the
// training log can't see: illness coming on, or work not being absorbed. Oura's
// overnight figure is stable enough that five beats is well clear of noise.
export const RHR_RISE_BPM = 5;

// A fall in heart-rate variability of this much against baseline points the
// same way. HRV is noisy night to night, which is why this reads a seven-day
// average against a month rather than yesterday against the day before.
export const HRV_DROP_PCT = 15;

// Below this many nights in a window, an average is describing the gaps as much
// as the sleep, so nothing is reported rather than reporting a number built
// from two nights that happen to be in range.
const MIN_NIGHTS = 3;

/** The main sleep period of a night, or null if there wasn't one. */
function mainPeriod(periods) {
	const nights = (periods || []).filter((p) => MAIN_SLEEP_TYPES.has(p?.type));
	if (nights.length === 0) return null;
	// More than one main period in a night is a broken sleep recorded as two.
	// The longer one carries the heart-rate figures; durations are summed
	// below, since you did sleep for both of them.
	return nights.reduce((best, p) =>
		(reading(p?.total_sleep_duration) || 0) > (reading(best?.total_sleep_duration) || 0) ? p : best,
	);
}

/**
 * Reduce a day's Oura documents to the record we store.
 *
 * Nothing here is derived — Oura has already done the sleep staging and the
 * scoring, and re-deriving any of it from raw samples would be inventing a
 * second opinion. This is a projection, not a model.
 *
 * @param {object} input
 * @param {string} input.day day key.
 * @param {object[]} [input.periods] sleep documents for that day.
 * @param {object} [input.dailySleep] the daily_sleep document.
 * @param {object} [input.readiness] the daily_readiness document.
 * @returns {object|null} null when there's no night to describe.
 */
export function shapeNight({ day, periods = [], dailySleep = null, readiness = null }) {
	const main = mainPeriod(periods);
	if (!main) return null;

	const nights = (periods || []).filter((p) => MAIN_SLEEP_TYPES.has(p?.type));
	const sleepSec = nights.reduce((sum, p) => sum + (reading(p?.total_sleep_duration) || 0), 0);
	if (!(sleepSec > 0)) return null;

	const finite = (value) => (Number.isFinite(reading(value)) ? reading(value) : null);

	return {
		day,
		sleepSec,
		timeInBedSec: finite(main.time_in_bed),
		efficiencyPct: finite(main.efficiency),
		latencySec: finite(main.latency),
		remSec: finite(main.rem_sleep_duration),
		deepSec: finite(main.deep_sleep_duration),
		// Oura's own term is "lowest heart rate", and overnight it's the
		// closest thing to a true resting rate anything here measures.
		restingHr: finite(main.lowest_heart_rate),
		averageHrv: finite(main.average_hrv),
		sleepScore: finite(dailySleep?.score),
		readinessScore: finite(readiness?.score),
		temperatureDeviationC: finite(readiness?.temperature_deviation),
	};
}

/**
 * Shape whole collections into one record per day, oldest first.
 *
 * @param {object} input
 * @param {object[]} [input.sleep] /v2/usercollection/sleep documents.
 * @param {object[]} [input.dailySleep] /v2/usercollection/daily_sleep documents.
 * @param {object[]} [input.readiness] /v2/usercollection/daily_readiness documents.
 * @returns {object[]}
 */
export function shapeRecovery({ sleep = [], dailySleep = [], readiness = [] }) {
	const byDay = new Map();
	for (const doc of sleep) {
		const day = toDayKey(doc?.day);
		if (!day) continue;
		if (!byDay.has(day)) byDay.set(day, []);
		byDay.get(day).push(doc);
	}
	const index = (docs) => new Map((docs || []).map((d) => [toDayKey(d?.day), d]).filter(([k]) => k));
	const sleepScores = index(dailySleep);
	const readinessScores = index(readiness);

	return [...byDay.entries()]
		.map(([day, periods]) =>
			shapeNight({
				day,
				periods,
				dailySleep: sleepScores.get(day) || null,
				readiness: readinessScores.get(day) || null,
			}),
		)
		.filter(Boolean)
		.sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Mean of one field across a window ending on `to`, ignoring days with no
 * reading at all.
 *
 * Missing days are skipped rather than counted as zero, which is the opposite
 * of how daily training load works and matters more than it sounds. A day with
 * no run really is a day of no load; a night with no record is a night the ring
 * was on a bedside table, and averaging it in as "no sleep" would manufacture
 * exactly the alarm this is supposed to raise honestly.
 *
 * @param {object[]} records
 * @param {string} field
 * @param {{to: string, days: number}} window
 * @returns {{mean: number|null, nights: number}}
 */
export function windowMean(records, field, { to, days }) {
	const from = addDays(to, -(days - 1));
	if (!from) return { mean: null, nights: 0 };
	const span = new Set(eachDay(from, to));
	let total = 0;
	let nights = 0;
	for (const record of records || []) {
		if (!span.has(record?.day)) continue;
		const value = reading(record?.[field]);
		if (!Number.isFinite(value)) continue;
		total += value;
		nights += 1;
	}
	return { mean: nights >= MIN_NIGHTS ? total / nights : null, nights };
}

// Recent against established, for one measure. Returns nulls rather than a
// partial answer, so the panel can say "not enough nights yet" instead of
// drawing a delta against a baseline of four numbers.
function trend(records, field, today) {
	const acute = windowMean(records, field, { to: today, days: ACUTE_DAYS });
	const baseline = windowMean(records, field, { to: today, days: CHRONIC_DAYS });
	const delta =
		acute.mean !== null && baseline.mean !== null ? acute.mean - baseline.mean : null;
	return {
		recent: acute.mean,
		baseline: baseline.mean,
		delta,
		deltaPct:
			delta !== null && baseline.mean > 0 ? (delta / baseline.mean) * 100 : null,
		nights: acute.nights,
	};
}

/**
 * The recovery half of the dashboard payload.
 *
 * @param {object[]} records shaped nights, any order.
 * @param {{today: string, days?: number}} options
 * @returns {object|null} null when there's nothing recorded at all, so the
 *   panel can be absent rather than empty.
 */
export function recoverySummary(records, { today, days = CHRONIC_DAYS }) {
	const day = toDayKey(today);
	const sorted = [...(records || [])]
		.filter((r) => r?.day && r.day <= day)
		.sort((a, b) => a.day.localeCompare(b.day));
	if (sorted.length === 0) return null;

	const from = addDays(day, -(days - 1));
	const window = new Set(eachDay(from, day));

	return {
		// The most recent night on record, which on a morning before the ring
		// has synced is the night before last. Dated so the page can say so
		// rather than implying it's last night.
		latest: sorted.at(-1),
		sleep: trend(sorted, "sleepSec", day),
		restingHr: trend(sorted, "restingHr", day),
		hrv: trend(sorted, "averageHrv", day),
		// Enough to draw a month of sparklines, and no more: this is served
		// publicly, and a longer history says more about the person than it
		// does about the training.
		series: sorted
			.filter((r) => window.has(r.day))
			.map((r) => ({
				day: r.day,
				sleepSec: r.sleepSec,
				restingHr: r.restingHr,
				averageHrv: r.averageHrv,
				sleepScore: r.sleepScore,
				readinessScore: r.readinessScore,
			})),
	};
}
