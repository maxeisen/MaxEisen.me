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

// Ordering for display: the things that get you injured come before the things
// that make you slower.
const SEVERITY_RANK = { critical: 0, warning: 1, info: 2, good: 3 };

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
		said.push("your overnight heart rate is up on baseline");
	}
	if (strain?.hrvDown) {
		said.push("HRV is below it");
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
		return " Your overnight heart rate and HRV are both at baseline, though, which is your body saying it's absorbing this. Form is derived from the training log alone — it can only tell you what you already told it.";
	}
	if (strain?.state === "buried") {
		return ` Your body agrees: ${markersOf(strain)}. That's the version of this worth acting on rather than training through.`;
	}
	return "";
}

/** The temperature clause, on the rules where it's corroborating something. */
function temperatureNote(strain) {
	if (!strain?.temperatureUp) {
		return "";
	}
	return ` Your skin temperature is ${strain.temperatureDeviationC.toFixed(1)} °C above your own normal, which points the same way.`;
}

/**
 * Whether the training explains a raised marker — the question the training
 * log can't answer about itself.
 */
function explainedBy(strain) {
	if (strain?.state === "unexplained") {
		return ` Your form is ${strain.tsb.toFixed(0)}, so the training doesn't explain it: a rise with no load behind it is more often illness, travel, or a run of short nights than it is the running.${temperatureNote(strain)}`;
	}
	if (strain?.state === "buried") {
		return ` Form is ${strain.tsb.toFixed(0)} as well, so this is consistent with the block you're in — the thing to watch is whether it lifts when you ease off.${temperatureNote(strain)}`;
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
					"You're ramping faster than you're adapting",
					`Your last 7 days carry ${acwr.ratio.toFixed(2)}× the load of your 28-day average. Above ${ACWR_CEILING} is where injury rates climb sharply. Hold the next few days easy and let the chronic average catch up rather than pushing on.`,
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
					"Training load has dropped off",
					`Your last 7 days are only ${acwr.ratio.toFixed(2)}× your 28-day average. Below ${ACWR_FLOOR} you start losing fitness. If this wasn't a planned down week, add volume back gradually — not all at once.`,
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
					"Load progression is in the safe range",
					`Acute-to-chronic ratio is ${acwr.ratio.toFixed(2)}, inside the ${ACWR_FLOOR}–${ACWR_CEILING} corridor.`,
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
				"You're carrying deep fatigue",
				`Form is ${latest.tsb.toFixed(0)}, below ${TSB_FATIGUE}. That's normal in a heavy block but not somewhere to live. If it doesn't lift within a week, take two genuinely easy days.${secondOpinion(strain)}`,
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
				"Your week is too concentrated in one run",
				`The long run was ${share.toFixed(0)}% of ${thisOrLast}'s distance, above the ${LONG_RUN_SHARE_CEILING}% guideline. Add an easy midweek run rather than shortening the long one — the aerobic work is worth keeping.`,
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
			? `an acute:chronic ratio of ${acwr.ratio.toFixed(2)}`
			: `a ${basis.rampPct.toFixed(0)}% jump in volume`;
		out.push(
			rule(
				"sleep-and-ramp",
				"critical",
				"You're adding load faster than you're recovering from it",
				`${duration(sleep.recent)} a night on average over the last week, against ${why}. Short sleep is one of the better-evidenced injury risk factors in athletes, and it compounds a ramp rather than sitting alongside it — the same week of running is a different proposition on eight hours than on ${duration(sleep.recent)}. Hold the volume where it is until sleep comes back up.`,
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
				"You're running short on sleep",
				`${duration(sleep.recent)} a night over the last week, against a ${duration(SLEEP_TARGET_SEC)} floor${Number.isFinite(sleep.baseline) ? ` and your own ${duration(sleep.baseline)} average` : ""}. Sleep is where the adaptation actually happens, so this quietly costs you more of the training than a missed easy run would.`,
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
				"Your overnight heart rate is up",
				`Averaging ${restingHr.recent.toFixed(0)} bpm over the last week against a ${restingHr.baseline.toFixed(0)} bpm baseline, up ${restingHr.delta.toFixed(0)}. A rise of ${RHR_RISE_BPM} or more usually means something the training log can't see: illness coming on, or work you haven't absorbed yet.${explainedBy(strain)} Worth an easy few days before a key session rather than after one.`,
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
				"Heart-rate variability is below your baseline",
				// The attribution is only added when HRV is the one marker
				// raising a hand; otherwise the heart-rate rule above has
				// already said it, in the same words.
				`${hrv.recent.toFixed(0)} ms over the last week against a ${hrv.baseline.toFixed(0)} ms baseline, down ${Math.abs(hrv.deltaPct).toFixed(0)}%. HRV is noisy night to night and this is a week against a month, so it's worth noting rather than acting on alone — but read it alongside the resting heart rate above.${strain?.restingHrUp ? "" : explainedBy(strain)}`,
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
				"You're recovering as fast as you're training",
				`${duration(sleep.recent)} a night over the last week${Number.isFinite(restingHr.recent) ? `, with overnight heart rate at ${restingHr.recent.toFixed(0)} bpm` : ""}. Nothing here says the training isn't being absorbed.`,
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
					"Your easy runs aren't easy enough",
					`Only ${intensity.easyPct.toFixed(0)}% of your running is in zones 1-2, against a target near ${EASY_SHARE_TARGET}%. Running easy days moderately hard is the most common way to arrive at a marathon tired rather than fit. Slow the easy days down.`,
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
					"Intensity distribution looks right",
					`${intensity.easyPct.toFixed(0)}% of your running is easy, close to the ${EASY_SHARE_TARGET}% target.`,
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
				"Heart rate drifted on your recent long run",
				`Aerobic decoupling was ${longRunDecouplingPct.toFixed(1)}%, above the ${DECOUPLING_CEILING}% marker. Your pace faded relative to heart rate in the second half, which usually means the aerobic base still needs work. Keep long runs easy rather than pushing the finish.`,
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
					"You came in under this week's plan",
					`${currentWeek.actualKm.toFixed(0)} km against a target of ${currentWeek.targetKm} km (${currentWeek.volumePct.toFixed(0)}%). One week matters little; two in a row is worth adjusting the plan for rather than trying to make up.`,
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
				`${daysToRace} days out — hold the taper`,
				"Fitness is already banked; the work now is arriving fresh. Keep some intensity to stay sharp but cut volume substantially, and resist the urge to test yourself.",
				daysToRace,
				21,
				"days",
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
					`Current form projects ${duration(prediction.predictedSec)} against your ${duration(goal.goalTimeSec)} target — which needs ${pace(goal.goalPaceSecPerKm)}. The projection starts from recent race performances and then discounts for how marathon-ready the current training actually is.`,
					prediction.predictedSec,
					goal.goalTimeSec,
					"duration",
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
					"duration",
				),
			);
		}
	}

	return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
