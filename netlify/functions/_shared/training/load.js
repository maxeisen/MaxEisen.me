// Per-run training load.
//
// Everything downstream (fitness, fatigue, form, acute:chronic ratio) is an
// average of daily load, so load is the single number the whole model rests on.
//
// Preferred method is Banister's TRIMP, which weights duration by heart-rate
// reserve on an exponential curve — time near threshold counts for far more
// than time jogging, which is what makes it better than "minutes run":
//
//   HRr   = (HRavg − HRrest) / (HRmax − HRrest)
//   TRIMP = minutes × HRr × 0.64 × e^(1.92·HRr)
//
// When a run has no heart rate (watch worn loose, strap forgotten, treadmill)
// we fall back to a pace-based load using GAP against threshold pace, the
// running equivalent of TSS:
//
//   IF   = thresholdPace / gapPace        (a ratio of speeds)
//   rTSS = seconds × IF² / 3600 × 100
//
// The two are on different natural scales — an hour at threshold is ~167 TRIMP
// but 100 rTSS — so raw TRIMP would silently inflate every HR-equipped run
// relative to the fallback, and any week mixing the two would show a phantom
// spike. TRIMP is therefore normalised to the same "an hour at threshold is
// 100" scale before it leaves this module.

import { activityGap } from "./gap.js";
import { reading } from "./num.js";

// Banister's coefficients for men. The exponent is what makes hard running
// count disproportionately; the constant just sets the scale.
const TRIMP_C = 0.64;
const TRIMP_K = 1.92;

// Heart-rate reserve at lactate threshold, used only as the reference point
// that puts TRIMP and rTSS on a common scale.
const THRESHOLD_HR_RESERVE = 0.85;

// One hour at threshold, in raw TRIMP. The divisor in the normalisation below.
const TRIMP_AT_THRESHOLD_HOUR =
	60 * THRESHOLD_HR_RESERVE * TRIMP_C * Math.exp(TRIMP_K * THRESHOLD_HR_RESERVE);

// Every load method is expressed against this: one hour at threshold = 100.
export const LOAD_AT_THRESHOLD_HOUR = 100;

/**
 * Fraction of the usable heart-rate range a run sat at. Clamped to [0,1] so a
 * misread spike above max HR can't produce an absurd exponential.
 *
 * @param {number} avgHr
 * @param {{maxHr?: number, restingHr?: number}} thresholds
 * @returns {number|null} null when HR data or the athlete's range is missing.
 */
export function heartRateReserve(avgHr, thresholds = {}) {
	const hr = reading(avgHr);
	const max = reading(thresholds.maxHr);
	const rest = reading(thresholds.restingHr);
	if (!Number.isFinite(hr) || !Number.isFinite(max) || !Number.isFinite(rest)) return null;
	// A zero or negative average is a sensor failure, not an easy run.
	if (hr <= 0 || max <= rest) return null;
	return Math.max(0, Math.min(1, (hr - rest) / (max - rest)));
}

/**
 * Raw Banister TRIMP. Exported mostly so the scaling stays testable.
 *
 * @param {number} durationSec
 * @param {number} avgHr
 * @param {{maxHr?: number, restingHr?: number}} thresholds
 * @returns {number|null}
 */
export function banisterTrimp(durationSec, avgHr, thresholds) {
	const minutes = Number(durationSec) / 60;
	if (!Number.isFinite(minutes) || minutes <= 0) return null;
	const hrr = heartRateReserve(avgHr, thresholds);
	if (hrr === null) return null;
	return minutes * hrr * TRIMP_C * Math.exp(TRIMP_K * hrr);
}

/**
 * Put raw TRIMP on the shared "hour at threshold = 100" scale.
 *
 * @param {number} trimp
 * @returns {number}
 */
export function normalizeTrimp(trimp) {
	return (trimp / TRIMP_AT_THRESHOLD_HOUR) * LOAD_AT_THRESHOLD_HOUR;
}

/**
 * Pace-based load, for runs with no heart rate. Uses GAP so a hilly run isn't
 * scored as easy just because the raw pace was slow.
 *
 * @param {number} durationSec
 * @param {number} gapPaceSecPerKm
 * @param {number} thresholdPaceSecPerKm
 * @returns {number|null}
 */
export function paceLoad(durationSec, gapPaceSecPerKm, thresholdPaceSecPerKm) {
	const sec = Number(durationSec);
	const gap = Number(gapPaceSecPerKm);
	const threshold = Number(thresholdPaceSecPerKm);
	if (!(sec > 0) || !(gap > 0) || !(threshold > 0)) return null;
	// Pace is inverted speed, so the faster-than-threshold case is the one
	// where gap is the SMALLER number — hence threshold on top.
	const intensityFactor = threshold / gap;
	return ((sec * intensityFactor * intensityFactor) / 3600) * LOAD_AT_THRESHOLD_HOUR;
}

/**
 * Load for one shaped activity, preferring heart rate and falling back to pace.
 *
 * @param {{movingTimeSec?: number, averageHr?: number, gapPaceSecPerKm?: number,
 *   distanceM?: number}} activity
 * @param {{maxHr?: number, restingHr?: number, thresholdPaceSecPerKm?: number}} thresholds
 * @returns {{load: number, method: "hr"|"pace"}|null}
 */
export function activityLoad(activity, thresholds = {}) {
	const durationSec = Number(activity?.movingTimeSec) || 0;

	const trimp = banisterTrimp(durationSec, activity?.averageHr, thresholds);
	if (trimp !== null) return { load: normalizeTrimp(trimp), method: "hr" };

	// TRIMP is the one part of this model that doesn't care which sport you
	// did — heart-rate reserve is heart-rate reserve. The fallback below very
	// much does care: it reads a threshold *running* pace, so applying it to a
	// bike would invent load out of the fact that bikes are faster. A ride
	// without heart rate is therefore unscored rather than guessed at.
	if (activity?.sport === "ride") return null;

	const gap =
		Number(activity?.gapPaceSecPerKm) ||
		activityGap(activity)?.gapPaceSecPerKm ||
		0;
	const fromPace = paceLoad(durationSec, gap, thresholds.thresholdPaceSecPerKm);
	if (fromPace !== null) return { load: fromPace, method: "pace" };

	return null;
}

/**
 * Total load per calendar day, keyed by local `YYYY-MM-DD`.
 *
 * Local rather than UTC deliberately: a 7pm Toronto run belongs to the day you
 * ran it, not to tomorrow. Shaped activities already carry a local date.
 *
 * @param {{startDateLocal?: string, load?: number}[]} activities
 * @returns {Map<string, number>}
 */
export function dailyLoads(activities) {
	const byDay = new Map();
	for (const a of activities || []) {
		const day = String(a?.startDateLocal || "").slice(0, 10);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
		byDay.set(day, (byDay.get(day) || 0) + (Number(a.load) || 0));
	}
	return byDay;
}
