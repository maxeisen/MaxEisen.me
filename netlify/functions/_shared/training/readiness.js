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
import { strainSignal } from "./response.js";

const finite = (value) => (Number.isFinite(reading(value)) ? reading(value) : null);

function sleepTerm(night, sleep) {
	const hours = finite(night?.sleepSec);
	const baseline = finite(sleep?.baseline);
	if (hours === null || baseline === null || baseline === 0) return null;
	return ((hours - baseline) / 3600) * 10;
}

function hrvTerm(night, hrv) {
	const last = finite(night?.averageHrv);
	const baseline = finite(hrv?.baseline);
	if (last === null || baseline === null || baseline === 0) return null;
	return ((last - baseline) / baseline) * 100;
}

function rhrTerm(night, restingHr) {
	const last = finite(night?.restingHr);
	const baseline = finite(restingHr?.baseline);
	if (last === null || baseline === null) return null;
	return -(last - baseline) * 2;
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
		night: night?.day || null,
		strain: strain?.state ?? null,
	};
}
