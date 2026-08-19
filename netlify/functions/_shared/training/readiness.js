// A signed readiness number that sits beside fitness, fatigue and form.
//
// CTL, ATL and form stay a closed loop of daily load — see fitness.js. This
// module reads that form and last night's ring data, writes to neither, and
// returns a new figure so a short night can show up on the page without
// pretending it was a training session.
//
// The scale is form-like points, not 0–100. Oura already computes a readiness
// score and we already store it; inventing another one in the same units would
// be a number nobody could unpack. Averaging z-scores would print −1 next to a
// form of −18 and look like nothing. Putting each ingredient on the same
// scale as form is what "signed, like form" means, and returning the terms
// next to the headline is what keeps it interrogable.

import { reading } from "./num.js";
import { HRV_DROP_PCT, RHR_RISE_BPM } from "./recovery.js";
import { strainSignal } from "./response.js";

const finite = (value) => (Number.isFinite(reading(value)) ? reading(value) : null);

// A notable overnight move scores 10, matching an hour of sleep vs baseline.
// That's 15% HRV and 5 bpm RHR — the same thresholds strainSignal already
// treats as a raised hand. Last night's HRV on this athlete ranged 22–120 in
// a week; percent-for-point called a bounce-back +68 and drowned form.
const NOTABLE_POINTS = 10;

// Overnight terms cannot outrun this. Form is typically −25 to +10; a single
// spectacular night must not print as a different sport.
export const OVERNIGHT_TERM_CAP = 15;

function clampOvernight(value) {
	if (value === null) return null;
	return Math.max(-OVERNIGHT_TERM_CAP, Math.min(OVERNIGHT_TERM_CAP, value));
}

function sleepTerm(night, sleep) {
	const hours = finite(night?.sleepSec);
	const baseline = finite(sleep?.baseline);
	if (hours === null || baseline === null || baseline === 0) return null;
	return clampOvernight(((hours - baseline) / 3600) * NOTABLE_POINTS);
}

function hrvTerm(night, hrv) {
	const last = finite(night?.averageHrv);
	const baseline = finite(hrv?.baseline);
	if (last === null || baseline === null || baseline === 0) return null;
	const deltaPct = ((last - baseline) / baseline) * 100;
	return clampOvernight((deltaPct / HRV_DROP_PCT) * NOTABLE_POINTS);
}

function rhrTerm(night, restingHr) {
	const last = finite(night?.restingHr);
	const baseline = finite(restingHr?.baseline);
	if (last === null || baseline === null) return null;
	return clampOvernight(-((last - baseline) / RHR_RISE_BPM) * NOTABLE_POINTS);
}

function meanOf(values) {
	const parts = values.filter((v) => v !== null);
	if (parts.length === 0) return null;
	return parts.reduce((sum, v) => sum + v, 0) / parts.length;
}

/**
 * Today's readiness, as of now.
 *
 * Form includes today's run if it has landed. Sleep, HRV and RHR are last
 * night against the 28-day baseline. A missing ingredient drops out of the
 * mean rather than counting as zero. No overnight reading at all is null —
 * echoing form would be a second copy of a number the page already has.
 *
 * @param {object} input
 * @param {number|null} input.tsb today's form.
 * @param {object|null} input.recovery from recoverySummary().
 * @returns {{value: number, terms: object, night: string|null, strain: string|null}|null}
 */
export function readiness({ tsb = null, recovery = null } = {}) {
	if (!recovery) return null;

	const night = recovery.latest || null;
	const terms = {
		form: finite(tsb),
		sleep: sleepTerm(night, recovery.sleep),
		hrv: hrvTerm(night, recovery.hrv),
		rhr: rhrTerm(night, recovery.restingHr),
	};

	const overnight = [terms.sleep, terms.hrv, terms.rhr].filter((v) => v !== null);
	if (overnight.length === 0) return null;

	const strain = strainSignal({ tsb, recovery });
	return {
		value: meanOf([terms.form, terms.sleep, terms.hrv, terms.rhr]),
		terms,
		// Native units, so the row under the headline can say "RHR 44" after
		// a low night rather than "RHR +10", which reads as the opposite.
		readings: {
			sleepSec: finite(night?.sleepSec),
			sleepBaselineSec: finite(recovery.sleep?.baseline),
			averageHrv: finite(night?.averageHrv),
			hrvBaseline: finite(recovery.hrv?.baseline),
			restingHr: finite(night?.restingHr),
			rhrBaseline: finite(recovery.restingHr?.baseline),
		},
		night: night?.day || null,
		strain: strain?.state ?? null,
	};
}
