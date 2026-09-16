// Deterministic training recommendations.
//
// Every recommendation is a pure function of the computed metrics, and every
// one carries the number that triggered it plus the threshold it crossed. That
// matters more than it might look: a coaching suggestion you can't interrogate
// is one you can't sensibly ignore, and mid-block you will want to overrule
// some of these. Nothing here is generated or phrased by a model — the same
// inputs always produce the same advice, and you can always ask "why".
//
// Rules are intentionally conservative and mostly about restraint. The failure
// modes that ruin a marathon build are ramping too fast, running easy days too
// hard, and skipping the taper; none of those are fixed by working harder.

import { ACWR_CEILING, ACWR_FLOOR, SAFE_RAMP_PCT, TSB_FATIGUE } from "./fitness.js";
import { EASY_SHARE_TARGET } from "./zones.js";
import { HRV_DROP_PCT, RHR_RISE_BPM, SLEEP_TARGET_SEC } from "./recovery.js";
import { copy, duration, pace } from "./recommendCopy.js";

// Ordering for display: the things that get you injured come before the things
// that make you slower.
const SEVERITY_RANK = { critical: 0, warning: 1, info: 2, good: 3 };

// A long run beyond this share of weekly volume is a week built around one run.
const LONG_RUN_SHARE_CEILING = 35;
// Aerobic decoupling above this on a long run points to endurance not yet built.
const DECOUPLING_CEILING = 5;
// Falling this far short of a week's planned volume is worth flagging.
const VOLUME_SHORTFALL_PCT = 85;

function plannedLongRunKm(week) {
	const fromTarget = Number(week?.longRunTargetKm);
	if (fromTarget > 0) return Math.round(fromTarget);
	const sessions = week?.sessions || [];
	const long = sessions.find((s) => String(s.type || "").toLowerCase().includes("long"));
	const km = Number(long?.distanceKm);
	return km > 0 ? Math.round(km) : null;
}

function factorTone(prediction, id) {
	return (prediction?.factors || []).find((f) => f.id === id)?.tone || null;
}

/**
 * What to do about a goal gap, given how many days are left and what the plan
 * asks for this week. Distances come from the plan; the phase is the calendar.
 */
function goalAdvice({ prediction, goal, daysToRace, longRunDecouplingPct, currentWeek, behind }) {
	const predicted = duration(prediction.predictedSec);
	const target = duration(goal.goalTimeSec);
	const goalPace = pace(goal.goalPaceSecPerKm);
	const training = Number.isFinite(prediction.trainingSec) ? prediction.trainingSec : null;
	const aerobic = Number.isFinite(prediction.aerobicPotentialSec) ? prediction.aerobicPotentialSec : null;
	const historicSpeed =
		prediction.basisStatus === "historic" && aerobic != null && training != null && training > aerobic;
	const speedNote = historicSpeed ? copy.historicSpeed : "";
	const durabilityLimiting =
		factorTone(prediction, "durability") === "limiting" ||
		(Number.isFinite(longRunDecouplingPct) && longRunDecouplingPct > DECOUPLING_CEILING);
	const volumeLimiting = factorTone(prediction, "volume") === "limiting";
	const longKm = plannedLongRunKm(currentWeek);
	const days = Number.isFinite(daysToRace) ? daysToRace : null;

	if (!behind) {
		return copy.goalAhead.detail({ predicted, goalPace });
	}

	const gap = copy.gap({ predicted, target, goalPace });

	if (days != null && days <= 21) {
		return copy.goalBehind.taper({ goalPace, gap, speedNote });
	}

	if (days != null && days <= 28) {
		return copy.goalBehind.lastFullWeek({ longKm, durabilityLimiting, gap, speedNote });
	}

	return copy.goalBehind.build({
		longKm,
		volumeLimiting,
		decouplingCeiling: DECOUPLING_CEILING,
		gap,
		speedNote,
	});
}

/**
 * @param {string} [unit] how the panel should read `metric` and `threshold`.
 *   The pair is printed beside the rule as "12% vs 10%", and a bare number
 *   there is ambiguous in a list where the one above it is a ratio and the
 *   one below is a count of beats. Every rule that isn't a plain quantity
 *   says which it is:
 *
 *   - "duration" for the ones held in seconds — a goal time, a night's sleep
 *   - "percent" for shares, ramps and drifts
 *   - "ratio"   for acute:chronic, which reads as a multiple
 *   - "bpm"     for heart rate
 *   - "days"    for the countdown to the race
 *
 *   Only form is left bare, because training-stress balance genuinely has no
 *   unit: it's the difference between two loads on an arbitrary scale, and
 *   inventing "points" for it would imply a precision it doesn't have.
 */
function rule(id, severity, title, detail, metric, threshold, unit = null) {
	// Absent rather than null on the one rule that doesn't need it.
	return { id, severity, title, detail, metric, threshold, ...(unit ? { unit } : {}) };
}

/** Whichever overnight markers are currently raising a hand. */
function markersOf(strain) {
	const said = [];
	if (strain?.restingHrUp) {
		said.push(copy.markers.restingHr);
	}
	if (strain?.hrvDown) {
		said.push(copy.markers.hrv);
	}
	return said.join(" and ");
}

/**
 * What the ring has to say about a form number.
 *
 * Form is computed from the training log and nothing else, so it can only ever
 * report back what you already told it: run a lot and it goes negative,
 * whether or not you're coping. An overnight heart rate is an independent
 * measurement of the same question, and it's the disagreements that are worth
 * printing — the same −28 means "this is landing" or "stop" depending on it.
 */
function secondOpinion(strain) {
	if (strain?.state === "absorbing") {
		return copy.opinion.absorbing;
	}
	if (strain?.state === "buried") {
		return copy.opinion.buried({ markers: markersOf(strain) });
	}
	return "";
}

/** The temperature clause, on the rules where it's corroborating something. */
function temperatureNote(strain) {
	if (!strain?.temperatureUp) {
		return "";
	}
	return copy.temperature({ deviationC: strain.temperatureDeviationC });
}

/**
 * Whether the training explains a raised marker — the question the training
 * log can't answer about itself.
 */
function explainedBy(strain) {
	if (strain?.state === "unexplained") {
		return copy.explained.unexplained({ tsb: strain.tsb, temperature: temperatureNote(strain) });
	}
	if (strain?.state === "buried") {
		return copy.explained.buried({ tsb: strain.tsb, temperature: temperatureNote(strain) });
	}
	return "";
}

/**
 * Build the ranked recommendation list.
 *
 * @param {object} metrics the computed dashboard payload.
 * @returns {object[]} ordered by severity, most urgent first.
 */
export function recommendations(metrics) {
	const out = [];
	const {
		acwr = {},
		latest = {},
		intensity = {},
		currentWeek = null,
		rampBasis = null,
		prediction = null,
		goal = {},
		daysToRace = null,
		longRunDecouplingPct = null,
		recovery = null,
		strain = null,
	} = metrics || {};

	// --- Injury risk -------------------------------------------------------

	if (Number.isFinite(acwr.ratio)) {
		if (acwr.ratio > ACWR_CEILING) {
			out.push(
				rule(
					"acwr-high",
					"critical",
					copy.acwrHigh.title,
					copy.acwrHigh.detail({ ratio: acwr.ratio, ceiling: ACWR_CEILING }),
					acwr.ratio,
					ACWR_CEILING,
					"ratio",
				),
			);
		} else if (acwr.ratio < ACWR_FLOOR) {
			out.push(
				rule(
					"acwr-low",
					"warning",
					copy.acwrLow.title,
					copy.acwrLow.detail({ ratio: acwr.ratio, floor: ACWR_FLOOR }),
					acwr.ratio,
					ACWR_FLOOR,
					"ratio",
				),
			);
		} else {
			out.push(
				rule(
					"acwr-ok",
					"good",
					copy.acwrOk.title,
					copy.acwrOk.detail({ ratio: acwr.ratio, floor: ACWR_FLOOR, ceiling: ACWR_CEILING }),
					acwr.ratio,
					null,
					"ratio",
				),
			);
		}
	}

	if (Number.isFinite(latest.tsb) && latest.tsb < TSB_FATIGUE) {
		out.push(
			rule(
				"tsb-fatigued",
				"warning",
				copy.tsbFatigued.title,
				copy.tsbFatigued.detail({ tsb: latest.tsb, floor: TSB_FATIGUE, opinion: secondOpinion(strain) }),
				latest.tsb,
				TSB_FATIGUE,
			),
		);
	}

	// Ramp and long-run share only mean anything across a whole week, so
	// rampBasis points at the last completed one. Part-way through a week
	// that's the previous week, and the wording says so — a Tuesday reading
	// of "down 100% on last week" is an artefact of the calendar, not a
	// training signal.
	const basis = rampBasis || {};
	const thisOrLast = basis.isCurrentWeek ? "this week" : "last week";
	const priorWeek = basis.isCurrentWeek ? "the week before" : "the week before that";

	const ramp = basis.rampPct;
	if (Number.isFinite(ramp) && ramp > SAFE_RAMP_PCT) {
		const from = basis.previousKm || 0;
		const to = basis.actualKm || 0;
		out.push(
			rule(
				"ramp-fast",
				"warning",
				copy.rampFast.title({ isCurrentWeek: basis.isCurrentWeek }),
				copy.rampFast.detail({
					ramp,
					thisOrLast,
					priorWeek,
					from,
					to,
					ceiling: SAFE_RAMP_PCT,
					cap: to * 1.1,
				}),
				ramp,
				SAFE_RAMP_PCT,
				"percent",
			),
		);
	}

	const share = basis.longRunSharePct;
	if (Number.isFinite(share) && share > LONG_RUN_SHARE_CEILING) {
		out.push(
			rule(
				"long-run-share",
				"warning",
				copy.longRunShare.title,
				copy.longRunShare.detail({ share, thisOrLast, ceiling: LONG_RUN_SHARE_CEILING }),
				share,
				LONG_RUN_SHARE_CEILING,
				"percent",
			),
		);
	}

	// --- Recovery ----------------------------------------------------------
	//
	// The only rules here that read something other than training load. They
	// exist because load is blind to the thing that decides whether a week of
	// running is absorbed or merely survived, and the combination is what's
	// worth saying: a 12% ramp on eight hours a night and the same ramp on six
	// are different propositions, and neither number says so alone.
	//
	// Nothing in this section changes a metric. It reads them, and says what
	// the pair implies.

	const sleep = recovery?.sleep || {};
	const restingHr = recovery?.restingHr || {};
	const hrv = recovery?.hrv || {};

	const shortSleep = Number.isFinite(sleep.recent) && sleep.recent < SLEEP_TARGET_SEC;
	const ramping =
		(Number.isFinite(acwr.ratio) && acwr.ratio > ACWR_CEILING) ||
		(Number.isFinite(basis.rampPct) && basis.rampPct > SAFE_RAMP_PCT);

	if (shortSleep && ramping) {
		const why = Number.isFinite(acwr.ratio) && acwr.ratio > ACWR_CEILING
			? copy.sleepRampWhy.acwr({ ratio: acwr.ratio })
			: copy.sleepRampWhy.ramp({ ramp: basis.rampPct });
		out.push(
			rule(
				"sleep-and-ramp",
				"critical",
				copy.sleepAndRamp.title,
				copy.sleepAndRamp.detail({ sleep: duration(sleep.recent), why }),
				sleep.recent,
				SLEEP_TARGET_SEC,
				"duration",
			),
		);
	} else if (shortSleep) {
		out.push(
			rule(
				"sleep-short",
				"warning",
				copy.sleepShort.title,
				copy.sleepShort.detail({
					sleep: duration(sleep.recent),
					floor: duration(SLEEP_TARGET_SEC),
					baseline: Number.isFinite(sleep.baseline) ? duration(sleep.baseline) : null,
				}),
				sleep.recent,
				SLEEP_TARGET_SEC,
				"duration",
			),
		);
	}

	if (Number.isFinite(restingHr.delta) && restingHr.delta >= RHR_RISE_BPM) {
		out.push(
			rule(
				"rhr-elevated",
				"warning",
				copy.rhrElevated.title,
				copy.rhrElevated.detail({
					recent: restingHr.recent,
					baseline: restingHr.baseline,
					delta: restingHr.delta,
					threshold: RHR_RISE_BPM,
					explained: explainedBy(strain),
				}),
				restingHr.delta,
				RHR_RISE_BPM,
				"bpm",
			),
		);
	}

	if (Number.isFinite(hrv.deltaPct) && hrv.deltaPct <= -HRV_DROP_PCT) {
		out.push(
			rule(
				"hrv-suppressed",
				"info",
				copy.hrvSuppressed.title,
				copy.hrvSuppressed.detail({
					recent: hrv.recent,
					baseline: hrv.baseline,
					drop: Math.abs(hrv.deltaPct),
					explained: strain?.restingHrUp ? "" : explainedBy(strain),
				}),
				hrv.deltaPct,
				-HRV_DROP_PCT,
				"percent",
			),
		);
	}

	// Only worth saying when there was enough data to have said otherwise.
	if (
		Number.isFinite(sleep.recent) &&
		!shortSleep &&
		!(Number.isFinite(restingHr.delta) && restingHr.delta >= RHR_RISE_BPM)
	) {
		out.push(
			rule(
				"recovery-ok",
				"good",
				copy.recoveryOk.title,
				copy.recoveryOk.detail({ sleep: duration(sleep.recent), restingHr: restingHr.recent }),
				sleep.recent,
				SLEEP_TARGET_SEC,
				"duration",
			),
		);
	}

	// --- Intensity distribution -------------------------------------------

	if (Number.isFinite(intensity.easyPct)) {
		if (intensity.easyPct < EASY_SHARE_TARGET - 5) {
			out.push(
				rule(
					"easy-share-low",
					"warning",
					copy.easyShareLow.title,
					copy.easyShareLow.detail({ easyPct: intensity.easyPct, target: EASY_SHARE_TARGET }),
					intensity.easyPct,
					EASY_SHARE_TARGET,
					"percent",
				),
			);
		} else {
			out.push(
				rule(
					"easy-share-ok",
					"good",
					copy.easyShareOk.title,
					copy.easyShareOk.detail({ easyPct: intensity.easyPct, target: EASY_SHARE_TARGET }),
					intensity.easyPct,
					EASY_SHARE_TARGET,
					"percent",
				),
			);
		}
	}

	if (Number.isFinite(longRunDecouplingPct) && longRunDecouplingPct > DECOUPLING_CEILING) {
		out.push(
			rule(
				"decoupling-high",
				"info",
				copy.decouplingHigh.title,
				copy.decouplingHigh.detail({ decouplingPct: longRunDecouplingPct, ceiling: DECOUPLING_CEILING }),
				longRunDecouplingPct,
				DECOUPLING_CEILING,
				"percent",
			),
		);
	}

	// --- Plan adherence ----------------------------------------------------

	if (Number.isFinite(currentWeek?.volumePct) && currentWeek.weekComplete) {
		if (currentWeek.volumePct < VOLUME_SHORTFALL_PCT) {
			out.push(
				rule(
					"volume-short",
					"info",
					copy.volumeShort.title,
					copy.volumeShort.detail({
						actualKm: currentWeek.actualKm,
						targetKm: currentWeek.targetKm,
						volumePct: currentWeek.volumePct,
					}),
					currentWeek.volumePct,
					VOLUME_SHORTFALL_PCT,
					"percent",
				),
			);
		}
	}

	// --- Taper -------------------------------------------------------------

	if (Number.isFinite(daysToRace) && daysToRace >= 0 && daysToRace <= 21) {
		out.push(
			rule(
				"taper",
				"info",
				copy.taper.title({ days: daysToRace }),
				copy.taper.detail,
				daysToRace,
				21,
				"days",
			),
		);
	}

	// --- Goal tracking -----------------------------------------------------

	if (prediction && Number.isFinite(prediction.predictedSec) && Number.isFinite(goal.goalTimeSec)) {
		const delta = prediction.predictedSec - goal.goalTimeSec;
		const behind = delta > 0;
		out.push(
			rule(
				behind ? "goal-behind" : "goal-ahead",
				behind ? "info" : "good",
				behind
					? copy.goalBehind.title({ short: duration(Math.abs(delta)) })
					: copy.goalAhead.title({ target: duration(goal.goalTimeSec) }),
				goalAdvice({
					prediction,
					goal,
					daysToRace,
					longRunDecouplingPct,
					currentWeek,
					behind,
				}),
				prediction.predictedSec,
				goal.goalTimeSec,
				"duration",
			),
		);
	}

	return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
