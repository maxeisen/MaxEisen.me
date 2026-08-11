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

import { ACWR_CEILING, ACWR_FLOOR, SAFE_RAMP_PCT } from "./fitness.js";
import { EASY_SHARE_TARGET } from "./zones.js";

// Ordering for display: the things that get you injured come before the things
// that make you slower.
const SEVERITY_RANK = { critical: 0, warning: 1, info: 2, good: 3 };

// Form below this suggests accumulated fatigue rather than productive training.
const TSB_FATIGUE = -25;
// A long run beyond this share of weekly volume is a week built around one run.
const LONG_RUN_SHARE_CEILING = 35;
// Aerobic decoupling above this on a long run points to endurance not yet built.
const DECOUPLING_CEILING = 5;
// Falling this far short of a week's planned volume is worth flagging.
const VOLUME_SHORTFALL_PCT = 85;

function pace(secPerKm) {
	if (!(secPerKm > 0)) return "—";
	const m = Math.floor(secPerKm / 60);
	const s = Math.round(secPerKm % 60);
	return `${m}:${String(s).padStart(2, "0")}/km`;
}

function duration(sec) {
	if (!(sec > 0)) return "—";
	const h = Math.floor(sec / 3600);
	const m = Math.round((sec % 3600) / 60);
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function rule(id, severity, title, detail, metric, threshold) {
	return { id, severity, title, detail, metric, threshold };
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
		previousWeek = null,
		rampBasis = null,
		prediction = null,
		goal = {},
		daysToRace = null,
		longRunDecouplingPct = null,
	} = metrics || {};

	// --- Injury risk -------------------------------------------------------

	if (Number.isFinite(acwr.ratio)) {
		if (acwr.ratio > ACWR_CEILING) {
			out.push(
				rule(
					"acwr-high",
					"critical",
					"You're ramping faster than you're adapting",
					`Your last 7 days carry ${acwr.ratio.toFixed(2)}× the load of your 28-day average. Above ${ACWR_CEILING} is where injury rates climb sharply. Hold the next few days easy and let the chronic average catch up rather than pushing on.`,
					acwr.ratio,
					ACWR_CEILING,
				),
			);
		} else if (acwr.ratio < ACWR_FLOOR) {
			out.push(
				rule(
					"acwr-low",
					"warning",
					"Training load has dropped off",
					`Your last 7 days are only ${acwr.ratio.toFixed(2)}× your 28-day average. Below ${ACWR_FLOOR} you start losing fitness. If this wasn't a planned down week, add volume back gradually — not all at once.`,
					acwr.ratio,
					ACWR_FLOOR,
				),
			);
		} else {
			out.push(
				rule(
					"acwr-ok",
					"good",
					"Load progression is in the safe range",
					`Acute-to-chronic ratio is ${acwr.ratio.toFixed(2)}, inside the ${ACWR_FLOOR}–${ACWR_CEILING} corridor.`,
					acwr.ratio,
					null,
				),
			);
		}
	}

	if (Number.isFinite(latest.tsb) && latest.tsb < TSB_FATIGUE) {
		out.push(
			rule(
				"tsb-fatigued",
				"warning",
				"You're carrying deep fatigue",
				`Form is ${latest.tsb.toFixed(0)}, below ${TSB_FATIGUE}. That's normal in a heavy block but not somewhere to live. If it doesn't lift within a week, take two genuinely easy days.`,
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
				basis.isCurrentWeek ? "This week jumps too far in volume" : "Last week jumped too far in volume",
				`You were up ${ramp.toFixed(0)}% ${thisOrLast} on ${priorWeek} (${from.toFixed(0)} to ${to.toFixed(0)} km). The conventional ceiling is ${SAFE_RAMP_PCT}%. Hold the coming week near ${(to * 1.1).toFixed(0)} km rather than stacking another jump on top.`,
				ramp,
				SAFE_RAMP_PCT,
			),
		);
	}

	const share = basis.longRunSharePct;
	if (Number.isFinite(share) && share > LONG_RUN_SHARE_CEILING) {
		out.push(
			rule(
				"long-run-share",
				"warning",
				"Your week is too concentrated in one run",
				`The long run was ${share.toFixed(0)}% of ${thisOrLast}'s distance, above the ${LONG_RUN_SHARE_CEILING}% guideline. Add an easy midweek run rather than shortening the long one — the aerobic work is worth keeping.`,
				share,
				LONG_RUN_SHARE_CEILING,
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
					"Your easy runs aren't easy enough",
					`Only ${intensity.easyPct.toFixed(0)}% of your running is in zones 1-2, against a target near ${EASY_SHARE_TARGET}%. Running easy days moderately hard is the most common way to arrive at a marathon tired rather than fit. Slow the easy days down.`,
					intensity.easyPct,
					EASY_SHARE_TARGET,
				),
			);
		} else {
			out.push(
				rule(
					"easy-share-ok",
					"good",
					"Intensity distribution looks right",
					`${intensity.easyPct.toFixed(0)}% of your running is easy, close to the ${EASY_SHARE_TARGET}% target.`,
					intensity.easyPct,
					EASY_SHARE_TARGET,
				),
			);
		}
	}

	if (Number.isFinite(longRunDecouplingPct) && longRunDecouplingPct > DECOUPLING_CEILING) {
		out.push(
			rule(
				"decoupling-high",
				"info",
				"Heart rate drifted on your recent long run",
				`Aerobic decoupling was ${longRunDecouplingPct.toFixed(1)}%, above the ${DECOUPLING_CEILING}% marker. Your pace faded relative to heart rate in the second half, which usually means the aerobic base still needs work. Keep long runs easy rather than pushing the finish.`,
				longRunDecouplingPct,
				DECOUPLING_CEILING,
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
					"You came in under this week's plan",
					`${currentWeek.actualKm.toFixed(0)} km against a target of ${currentWeek.targetKm} km (${currentWeek.volumePct.toFixed(0)}%). One week matters little; two in a row is worth adjusting the plan for rather than trying to make up.`,
					currentWeek.volumePct,
					VOLUME_SHORTFALL_PCT,
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
				`${daysToRace} days out — hold the taper`,
				"Fitness is already banked; the work now is arriving fresh. Keep some intensity to stay sharp but cut volume substantially, and resist the urge to test yourself.",
				daysToRace,
				21,
			),
		);
	}

	// --- Goal tracking -----------------------------------------------------

	if (prediction && Number.isFinite(prediction.predictedSec) && Number.isFinite(goal.goalTimeSec)) {
		const delta = prediction.predictedSec - goal.goalTimeSec;
		if (delta > 0) {
			out.push(
				rule(
					"goal-behind",
					"info",
					`Projecting about ${duration(Math.abs(delta))} short of goal`,
					`Current form projects ${duration(prediction.predictedSec)} against your ${duration(goal.goalTimeSec)} target — which needs ${pace(goal.goalPaceSecPerKm)}. The projection is based on your best recent effort and assumes the endurance work continues, so treat it as a floor rather than a verdict.`,
					prediction.predictedSec,
					goal.goalTimeSec,
				),
			);
		} else {
			out.push(
				rule(
					"goal-ahead",
					"good",
					`On track for ${duration(goal.goalTimeSec)}`,
					`Current form projects ${duration(prediction.predictedSec)}, inside your goal. Goal pace is ${pace(goal.goalPaceSecPerKm)} — worth rehearsing in your remaining long runs.`,
					prediction.predictedSec,
					goal.goalTimeSec,
				),
			);
		}
	}

	return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
