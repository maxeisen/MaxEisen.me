// Whether the body agrees with the training log about how tired you are.
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
// perfectly well; read against each other they answer one the page couldn't
// ask before — form is derived entirely from load, so it can only ever tell
// you what you already told it, and whether your body agrees is a separate
// measurement. The interesting case is when it doesn't. A body that has
// stopped absorbing the work, or is coming down with something, is invisible
// to a training log and obvious in an overnight heart rate — and the same form
// of −28 means "this is landing, keep going" or "stop" depending entirely on
// which it is.
//
// It used to try two more questions of the same shape: what last night's sleep
// says about this morning's run, and what the block's hardest days have cost
// in sleep and resting heart rate against its easier ones. Both were dropped,
// for the same reason. A night has a run in it and also a late dinner, a hotel
// bed, a two-year-old and a glass of wine, and nothing here can separate them.
// Put a night beside a run and the page is claiming the run explains it,
// however carefully the caption is worded. The comparison above survives
// because it doesn't need the attribution: it's asking whether two independent
// measurements agree, and that's answerable without knowing why.

import { TSB_FATIGUE } from "./fitness.js";
import { reading } from "./num.js";
import { HRV_DROP_PCT, RHR_RISE_BPM } from "./recovery.js";

// Skin temperature this far above your own normal is Oura's own "something is
// coming" signal. It never triggers anything here — a warm bedroom does this
// too — but when the heart rate has already raised its hand, it's the piece of
// evidence that says which kind of tired this is.
export const TEMP_RISE_C = 0.5;

const finite = (value) => (Number.isFinite(reading(value)) ? reading(value) : null);

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
