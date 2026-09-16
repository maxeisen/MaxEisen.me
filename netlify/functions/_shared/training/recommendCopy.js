// Prose for the recommendation rules.
//
// recommend.js decides which rule fired. This file is the sentences that
// follow — so a copy pass does not have to hunt through thresholds, and a
// number from the plan or the log is interpolated rather than baked in.

export function pace(secPerKm) {
	if (!(secPerKm > 0)) return "—";
	const m = Math.floor(secPerKm / 60);
	const s = Math.round(secPerKm % 60);
	return `${m}:${String(s).padStart(2, "0")}/km`;
}

export function duration(sec) {
	if (!(sec > 0)) return "—";
	const h = Math.floor(sec / 3600);
	const m = Math.round((sec % 3600) / 60);
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function longRunClause(longKm, fallback) {
	return longKm ? `the planned ${longKm} km long run` : fallback;
}

export const copy = {
	acwrHigh: {
		title: "You're ramping faster than you're adapting",
		detail: ({ ratio, ceiling }) =>
			`Your last 7 days carry ${ratio.toFixed(2)}× the load of your 28-day average. Above ${ceiling} is where injury rates climb sharply. Hold the next few days easy and let the chronic average catch up rather than pushing on.`,
	},
	acwrLow: {
		title: "Training load has dropped off",
		detail: ({ ratio, floor }) =>
			`Your last 7 days are only ${ratio.toFixed(2)}× your 28-day average. Below ${floor} you start losing fitness. If this wasn't a planned down week, add volume back gradually — not all at once.`,
	},
	acwrOk: {
		title: "Load progression is in the safe range",
		detail: ({ ratio, floor, ceiling }) =>
			`Acute-to-chronic ratio is ${ratio.toFixed(2)}, inside the ${floor}–${ceiling} corridor.`,
	},
	tsbFatigued: {
		title: "You're carrying deep fatigue",
		detail: ({ tsb, floor, opinion }) =>
			`Form is ${tsb.toFixed(0)}, below ${floor}. That's normal in a heavy block but not somewhere to live. If it doesn't lift within a week, take two genuinely easy days.${opinion}`,
	},
	rampFast: {
		title: ({ isCurrentWeek }) =>
			isCurrentWeek ? "This week jumps too far in volume" : "Last week jumped too far in volume",
		detail: ({ ramp, thisOrLast, priorWeek, from, to, ceiling, cap }) =>
			`You were up ${ramp.toFixed(0)}% ${thisOrLast} on ${priorWeek} (${from.toFixed(0)} to ${to.toFixed(0)} km). The conventional ceiling is ${ceiling}%. Hold the coming week near ${cap.toFixed(0)} km rather than stacking another jump on top.`,
	},
	longRunShare: {
		title: "Your week is too concentrated in one run",
		detail: ({ share, thisOrLast, ceiling }) =>
			`The long run was ${share.toFixed(0)}% of ${thisOrLast}'s distance, above the ${ceiling}% guideline. Add an easy midweek run rather than shortening the long one — the aerobic work is worth keeping.`,
	},
	sleepAndRamp: {
		title: "You're adding load faster than you're recovering from it",
		detail: ({ sleep, why }) =>
			`${sleep} a night on average over the last week, against ${why}. Short sleep is one of the better-evidenced injury risk factors in athletes, and it compounds a ramp rather than sitting alongside it — the same week of running is a different proposition on eight hours than on ${sleep}. Hold the volume where it is until sleep comes back up.`,
	},
	sleepShort: {
		title: "You're running short on sleep",
		detail: ({ sleep, floor, baseline }) =>
			`${sleep} a night over the last week, against a ${floor} floor${baseline ? ` and your own ${baseline} average` : ""}. Sleep is where the adaptation actually happens, so this quietly costs you more of the training than a missed easy run would.`,
	},
	rhrElevated: {
		title: "Your overnight heart rate is up",
		detail: ({ recent, baseline, delta, threshold, explained }) =>
			`Averaging ${recent.toFixed(0)} bpm over the last week against a ${baseline.toFixed(0)} bpm baseline, up ${delta.toFixed(0)}. A rise of ${threshold} or more usually means something the training log can't see: illness coming on, or work you haven't absorbed yet.${explained} Worth an easy few days before a key session rather than after one.`,
	},
	hrvSuppressed: {
		title: "Heart-rate variability is below your baseline",
		detail: ({ recent, baseline, drop, explained }) =>
			`${recent.toFixed(0)} ms over the last week against a ${baseline.toFixed(0)} ms baseline, down ${drop.toFixed(0)}%. HRV is noisy night to night and this is a week against a month, so it's worth noting rather than acting on alone — but read it alongside the resting heart rate above.${explained}`,
	},
	recoveryOk: {
		title: "You're recovering as fast as you're training",
		detail: ({ sleep, restingHr }) =>
			`${sleep} a night over the last week${Number.isFinite(restingHr) ? `, with overnight heart rate at ${restingHr.toFixed(0)} bpm` : ""}. Nothing here says the training isn't being absorbed.`,
	},
	easyShareLow: {
		title: "Your easy runs aren't easy enough",
		detail: ({ easyPct, target }) =>
			`Only ${easyPct.toFixed(0)}% of your running is in zones 1-2, against a target near ${target}%. Running easy days moderately hard is the most common way to arrive at a marathon tired rather than fit. Slow the easy days down.`,
	},
	easyShareOk: {
		title: "Intensity distribution looks right",
		detail: ({ easyPct, target }) =>
			`${easyPct.toFixed(0)}% of your running is easy, close to the ${target}% target.`,
	},
	decouplingHigh: {
		title: "Heart rate drifted on your recent long run",
		detail: ({ decouplingPct, ceiling }) =>
			`Aerobic decoupling was ${decouplingPct.toFixed(1)}%, above the ${ceiling}% marker. Your pace faded relative to heart rate in the second half, which usually means the aerobic base still needs work. Keep long runs easy rather than pushing the finish.`,
	},
	volumeShort: {
		title: "You came in under this week's plan",
		detail: ({ actualKm, targetKm, volumePct }) =>
			`${actualKm.toFixed(0)} km against a target of ${targetKm} km (${volumePct.toFixed(0)}%). One week matters little; two in a row is worth adjusting the plan for rather than trying to make up.`,
	},
	taper: {
		title: ({ days }) => `${days} days out — hold the taper`,
		detail: "Fitness is already banked; the work now is arriving fresh. Keep some intensity to stay sharp but cut volume substantially, and resist the urge to test yourself.",
	},
	goalBehind: {
		title: ({ short }) => `Projecting about ${short} short of goal`,
		taper: ({ goalPace, gap, speedNote }) =>
			`These remaining days are a taper, not a chance to add kilometres. Rehearse ${goalPace} in short pieces and arrive fresh. ${gap}${speedNote}`,
		lastFullWeek: ({ longKm, durabilityLimiting, gap, speedNote }) => {
			const run = `Complete ${longRunClause(longKm, "the planned long run")}`;
			const easy = durabilityLimiting
				? " easy — drift is the limiter, not a missing interval"
				: " as written, and keep midweek kilometres easy";
			return `This is the last full week before the taper. ${run}${easy}. ${gap} The gap is not closed by adding kilometres.${speedNote}`;
		},
		build: ({ longKm, volumeLimiting, decouplingCeiling, gap, speedNote }) => {
			const run = longKm
				? `Keep ${longRunClause(longKm, "long runs")} easy enough to hold together.`
				: "Keep long runs easy enough to hold together.";
			if (volumeLimiting) {
				return `${run} Raise weekly volume toward 40–42 km and keep drift under ${decouplingCeiling}%. ${gap}${speedNote}`;
			}
			return `${run} Treat easy days as easy. ${gap}${speedNote}`;
		},
	},
	goalAhead: {
		title: ({ target }) => `On track for ${target}`,
		detail: ({ predicted, goalPace }) =>
			`Current form projects ${predicted}, inside your goal. Goal pace is ${goalPace} — worth rehearsing in your remaining long runs. The headline is the slower of recent race-equivalence and eight-week training support.`,
	},
	gap: ({ predicted, target, goalPace }) =>
		`Current form projects ${predicted} against your ${target} target — which needs ${goalPace}.`,
	historicSpeed:
		" Historic speed is still there; the last eight weeks have not yet shown you can hold it for 42 km.",
	sleepRampWhy: {
		acwr: ({ ratio }) => `an acute:chronic ratio of ${ratio.toFixed(2)}`,
		ramp: ({ ramp }) => `a ${ramp.toFixed(0)}% jump in volume`,
	},
	opinion: {
		absorbing:
			" Your overnight heart rate and HRV are both at baseline, though, which is your body saying it's absorbing this. Form is derived from the training log alone — it can only tell you what you already told it.",
		buried: ({ markers }) =>
			` Your body agrees: ${markers}. That's the version of this worth acting on rather than training through.`,
	},
	explained: {
		unexplained: ({ tsb, temperature }) =>
			` Your form is ${tsb.toFixed(0)}, so the training doesn't explain it: a rise with no load behind it is more often illness, travel, or a run of short nights than it is the running.${temperature}`,
		buried: ({ tsb, temperature }) =>
			` Form is ${tsb.toFixed(0)} as well, so this is consistent with the block you're in — the thing to watch is whether it lifts when you ease off.${temperature}`,
	},
	temperature: ({ deviationC }) =>
		` Your skin temperature is ${deviationC.toFixed(1)} °C above your own normal, which points the same way.`,
	markers: {
		restingHr: "your overnight heart rate is up on baseline",
		hrv: "HRV is below it",
	},
};
