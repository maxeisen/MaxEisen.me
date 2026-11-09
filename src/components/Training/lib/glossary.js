// Copy behind each running panel's "?" button. Thresholds quoted here are the
// ones the engine uses (netlify/functions/_shared/training/).
//
// House style: written to "you", plain words, a sentence or two per idea.
// Say what the panel shows and how to read it; leave out how it's computed
// unless that changes how you'd read it.

export const GLOSSARY = {
	today: {
		title: "Today",
		body: [
			"Where things stand this morning. Fitness, fatigue and form come from training load alone. Readiness is a separate read of how your body is coping, and never feeds back into them.",
			"Readiness averages four signals on the same scale as form: today's form, plus last night's sleep, HRV and resting heart rate, each against your 28-day baseline. An hour of sleep, 15% of HRV or 5 bpm of resting heart rate counts as a notable change, and one exceptional night is capped so it can't outweigh the rest.",
		],
		terms: [
			{ term: "Training", definition: "How fitness, fatigue and form changed since yesterday. Rest days move them too: fatigue fades faster than fitness, so form usually rises." },
			{ term: "Readiness", definition: "A signed number like form, not a score out of 100. The figures under it are last night's actual readings. It updates once a night; a run today only moves it through form." },
			{ term: "Session", definition: "What the plan has for today, and whether it's still ahead, done, extra or a rest day. Only shown when something is planned or you've already run." },
			{ term: "Projected", definition: "How today's running changed the projected marathon time — not the time itself. No run yet means no change." },
		],
	},

	lastRun: {
		title: "Last run",
		body: [
			"Your most recent run, compared with your own recent runs rather than in isolation: a load of 90 can be a big day for one runner and an ordinary Tuesday for another.",
			"The chart shows pace along the run, faster higher up, with heart rate on the right-hand scale. The dotted line is the run's average pace. Grade-adjusted pace is drawn as well when hills made it differ.",
		],
		terms: [
			{ term: "Load", definition: "Training stress, from time spent at each heart rate. \"% of typical\" compares it with your median run over the last six weeks." },
			{ term: "Fitness, fatigue and form", definition: "What the day's running changed. A hard run always adds more fatigue than fitness — that's the trade." },
			{ term: "Pacing", definition: "How the second half compared with the first. Within about 2% is even; quicker is a negative split. On a workout it simply describes the session." },
			{ term: "Drift", definition: "How far pace per heartbeat slipped from the first half to the second. Under 5% means the distance is within your aerobic base. Shown only for steady runs." },
		],
	},

	volume: {
		title: "Weekly volume",
		body: [
			"Kilometres run each week. When a training plan set a target, the short line across the bar shows it.",
			"Read the run of weeks, not any single one: one week under target is noise, several in a row means the plan has changed.",
		],
		terms: [
			{ term: "Taper", definition: "The planned drop in volume in the final weeks before a race. Taper weeks are shaded differently so a short bar doesn't read as a missed week." },
		],
	},

	fitness: {
		title: "Fitness and fatigue",
		body: [
			"Every run gets a training-load score from how hard and how long it was. This chart tracks two rolling averages of that score — fitness, which moves slowly, and fatigue, which moves fast — and form, the gap between them.",
			"Fitness uses the right-hand scale so a slow build stays visible; fatigue and form share the left. Form below zero is normal while training. It climbs back above zero when you rest or taper.",
		],
		terms: [
			{ term: "Fitness (CTL)", definition: "Your 42-day average training load. Slow to build and slow to lose." },
			{ term: "Fatigue (ATL)", definition: "Your 7-day average training load. Rises and falls within days, and reflects how tired you are now." },
			{ term: "Form (TSB)", definition: "Fitness minus fatigue. Negative means you're carrying fatigue, which is normal mid-training; positive means you're fresh, which is what you want on race day." },
		],
	},

	efficiency: {
		title: "Aerobic efficiency",
		body: [
			"Speed per heartbeat on easy and steady runs. A rising line means the same effort is buying more pace — the clearest sign your aerobic base is improving. The figure in the corner is the change over the last 12 weeks.",
			"Hard sessions are left out, because intensity raises the number on its own. The line is a 14-day average, so no single run decides it.",
		],
		terms: [
			{ term: "Efficiency factor", definition: "Grade-adjusted speed divided by heart rate. The value itself means little; its direction over weeks is what matters." },
			{ term: "Decoupling", definition: "How much pace per heartbeat drifts between the first and second half of a long run. Under 5% means you're aerobically ready for the distance." },
		],
	},

	recommendations: {
		title: "Recommendations",
		body: [
			"A fixed set of rules reads the numbers on this page and flags anything worth acting on. The same numbers always give the same advice, and each card shows the value that triggered it beside the threshold it crossed.",
			"Most rules are about holding back: ramping too fast, running easy days too hard, skipping recovery. With no race planned, the race rules switch off and the advice turns to recovering and keeping a base.",
		],
		terms: [
			{ term: "Act now", definition: "An injury or burnout risk that's live today. Worth changing this week's running for." },
			{ term: "Watch", definition: "Heading the wrong way, but not a problem yet." },
			{ term: "Note", definition: "Context rather than a warning." },
			{ term: "On track", definition: "A check that passed. Nothing to do." },
		],
	},

	prediction: {
		title: "Projected finish",
		body: [
			"The marathon time the last eight weeks of training support. It takes the slower of two models: one from weekly volume and training pace, one from recent race-quality efforts. Older personal bests are shown but don't prop the number up.",
			"Treat the range as the forecast and the single time as its centre. Recovery and form widen the range rather than moving the time.",
		],
		terms: [
			{ term: "Training", definition: "Tanda's model: average weekly distance and training pace over the last eight weeks, converted to a marathon time. Long runs move it even when they're nowhere near race pace." },
			{ term: "Aerobic", definition: "Riegel and Daniels' VDOT applied to recent race-quality efforts of 5 km or more. A result from months ago counts as past potential, not current fitness." },
			{ term: "Likely range", definition: "How uncertain the headline is, from model disagreement, missing marathon-specific training and current form." },
			{ term: "Goal pace", definition: "The average pace per kilometre the goal time requires." },
		],
	},

	load: {
		title: "Load and risk",
		body: [
			"The best early warning in training data: your last 7 days of load against your last 28. Inside the corridor you're adding training at a rate your body is keeping up with; above it, injury risk climbs sharply.",
			"Ramp and long-run share use the last complete week, so a quiet Monday doesn't look like a collapse.",
		],
		terms: [
			{ term: "Acute : chronic", definition: "7-day load divided by 28-day load. Aim for 0.8–1.5: above is a spike, below is detraining." },
			{ term: "Ramp", definition: "How much last week's distance grew over the week before. About 10% is the usual ceiling." },
			{ term: "Long run share", definition: "How much of the week's distance came from the long run. Above about 35% leans too hard on one run." },
			{ term: "Load", definition: "One run's training stress, from time spent at each heart rate. Only meaningful compared with your own other runs." },
		],
	},

	intensity: {
		title: "Intensity mix",
		body: [
			"Where your running time went over the last four weeks, by effort. Aim for about 80% easy — the split most successful endurance training settles on.",
			"Watch the moderate middle: it adds fatigue without the benefits of truly easy or truly hard running.",
			"Zones are set from lactate threshold heart rate, so they won't match Strava's, which are based on maximum heart rate.",
		],
		terms: [
			{ term: "Easy", definition: "Zones 1–2, below 90% of threshold heart rate. Conversational. Most of your running belongs here." },
			{ term: "Moderate", definition: "Zone 3, 90–95% of threshold. Feels productive, costs like hard running, and gives less back." },
			{ term: "Hard", definition: "Zones 4–5, above 95% of threshold. Threshold work and intervals — valuable in small doses." },
		],
	},

	week: {
		title: "This week",
		body: [
			"This week's plan day by day, with what you actually ran. Volume isn't judged mid-week: 40% on a Wednesday is on pace, not behind.",
			"A day only counts as missed once it's over.",
		],
		terms: [
			{ term: "Missed", definition: "A past day with a planned run and none recorded." },
			{ term: "Extra", definition: "A run on a day with nothing planned." },
			{ term: "Long run", definition: "One session on one day, so it shows as ahead, done or missed rather than as a progress bar." },
		],
	},

	recovery: {
		title: "Recovery",
		body: [
			"Sleep and overnight heart rate from an Oura ring, comparing the last 7 nights with your 28-day normal.",
			"Recovery doesn't feed fitness, fatigue or form, which come from training alone. It's a second opinion: deep fatigue with recovery at baseline means you're absorbing the training, while recovery slipping with little training behind it usually means illness, travel or short nights.",
			"Nights without a reading are skipped, not counted as zero.",
		],
		terms: [
			{ term: "Resting HR", definition: "Your lowest heart rate overnight. A rise of about 5 bpm over baseline often means illness or training you haven't absorbed." },
			{ term: "HRV", definition: "Heart-rate variability while you sleep. Higher generally means better recovered, but it's noisy night to night, so it's read as a week against a month." },
			{ term: "Baseline", definition: "Your own 28-day average for the same measure." },
		],
	},

	runs: {
		title: "Recent activity",
		body: [
			"Recent runs, newest first. While training for a race, runs on planned days are tagged with the session; anything else is marked extra.",
			"Pace and grade-adjusted pace sit side by side. On hilly runs they differ, and GAP is what the effort would have been on flat ground.",
			"Rides and strength sessions are listed for context but don't count toward any running numbers. Some runs carry a short note explaining them — the only thing here that isn't measured.",
		],
		terms: [
			{ term: "GAP", definition: "Grade-adjusted pace: pace corrected for hills, so hilly and flat runs compare fairly." },
			{ term: "Extra", definition: "A run on a day with no planned session." },
			{ term: "Ride", definition: "A ride over 20 km, listed for context. It doesn't count toward anything here." },
			{ term: "Strength", definition: "A gym session, listed because it's on the plan. It doesn't count toward running volume or the projection." },
			{ term: "Why / note", definition: "A tagged line from the Strava description, like \"excuse: wedding in the evening\". Only tagged lines are published." },
		],
	},
};
