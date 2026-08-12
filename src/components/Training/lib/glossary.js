// What every panel on /training actually means, in plain language.
//
// The dashboard is built out of sports-science vocabulary — CTL, ACWR, TRIMP,
// decoupling, VDOT, GAP — and a number you can't interpret is worse than no
// number, because it still looks like it's telling you something. Each entry
// here backs the "i" button on one card: a couple of sentences on what the
// panel is for, then definitions for the specific terms on it.
//
// Written for the athlete reading their own dashboard, not for a textbook:
// what the number is, what a good value looks like, and what to do when it
// isn't. Thresholds quoted here are the ones the engine actually uses (see
// netlify/functions/_shared/training/), so this file and the maths can't drift
// into saying different things.

export const GLOSSARY = {
	lastRun: {
		title: "Last run",
		body: [
			"The most recent run in the block, read against your own recent history rather than in isolation — a load of 90 is a big day or an ordinary Tuesday depending entirely on whose 90 it is.",
			"The chart is pace for each kilometre, drawn with faster higher up. The dotted line across it is the run's own average, so the shape tells you whether it held together; grade-adjusted pace appears over it only when the hills made the two differ.",
		],
		terms: [
			{ term: "Load", definition: "This run's training stress, from time spent at each heart rate. Compared here against the median run of your last six weeks, so 130% means half again as hard as your usual." },
			{ term: "Fitness, fatigue and form", definition: "What the day's running moved. Fitness is the 42-day average of load, fatigue the 7-day one, form the difference. A hard run always adds more fatigue than fitness — that's the trade you're making." },
			{ term: "Fade", definition: "How much slower the second half of the run was than the first. Under about 2% is even pacing; a negative number means you finished quicker than you started. On a workout the halves are just describing the session — intervals, then a jog home." },
			{ term: "Drift", definition: "Aerobic decoupling: how far pace-per-heartbeat slipped between the halves of the run. Under 5% means the distance is within your aerobic base. Only shown for runs held at one effort, since on an interval session it measures the intervals rather than your base." },
		],
	},

	volume: {
		title: "Weekly volume",
		body: [
			"How far you actually ran each week, against the week's target from the plan. The bar is what you ran; the short line above it is what was planned.",
			"Consistency matters more than any single week here. A week or two under target is noise; a run of them is the plan quietly changing.",
		],
		terms: [
			{ term: "Taper", definition: "The deliberate drop in volume over the last three weeks before the race. Those bars are meant to be short — they're marked in a different colour so a small one doesn't read as a missed week." },
		],
	},

	fitness: {
		title: "Fitness and fatigue",
		body: [
			"Every run is scored for training load — how hard it was, for how long — and this chart tracks two rolling averages of that score. Fitness is the slow one, fatigue the fast one.",
			"Fatigue above fitness means you're in the work and temporarily tired, which is where most of a build should sit. The lines crossing back the other way is what a taper is for: fatigue falls away, fitness stays, and you arrive fresh.",
		],
		terms: [
			{ term: "Fitness (CTL)", definition: "Your 42-day average training load. Slow to build and slow to lose — it's the fitness you've banked." },
			{ term: "Fatigue (ATL)", definition: "Your 7-day average training load. Rises and falls within days, and reflects how tired you are right now." },
			{ term: "Form (TSB)", definition: "Fitness minus fatigue. Negative means you're carrying fatigue (normal mid-block); positive means you're fresh, which is what you want on race day." },
		],
	},

	efficiency: {
		title: "Aerobic efficiency",
		body: [
			"How much speed you get per heartbeat on easy runs. A line that climbs means the same effort is buying more pace, which is the clearest sign that base fitness is genuinely improving rather than that last week happened to be cool and flat.",
			"Only aerobic runs are plotted — anything at or above threshold is left out, because efficiency rises with intensity by construction and including intervals would draw your workout schedule instead of a trend.",
		],
		terms: [
			{ term: "Efficiency factor", definition: "Grade-adjusted speed divided by heart rate. The absolute value doesn't mean much; the direction of travel over weeks does." },
			{ term: "Decoupling", definition: "How much your pace-per-heartbeat drifts between the first and second half of a long run. Under 5% means you're aerobically ready for the distance; above it means the distance is still ahead of the base." },
		],
	},

	recommendations: {
		title: "What to do about it",
		body: [
			"A fixed set of rules read the metrics on this page and flag anything worth acting on. Nothing here is generated by a model: the same numbers always produce the same advice, and every card shows the value that triggered it next to the threshold it crossed, so you can disagree with it on the evidence.",
			"The rules are mostly about restraint, because the things that ruin a marathon build — ramping too fast, running easy days hard, skipping the taper — are none of them fixed by working harder.",
		],
		terms: [
			{ term: "Act now", definition: "An injury or blow-up risk that's live today. Worth changing this week's running for." },
			{ term: "Watch", definition: "Heading the wrong way but not yet a problem. Worth knowing before it becomes one." },
			{ term: "Note", definition: "Context rather than a warning — something about where you are in the block." },
			{ term: "On track", definition: "A check that passed. Nothing to do." },
		],
	},

	prediction: {
		title: "Projected finish",
		body: [
			"What your recent hard efforts imply for the marathon, using two standard models. They disagree, and by how much is informative, so both are shown; the headline takes the slower of the two.",
			"Both assume you keep doing the endurance work, so treat this as a floor for a well-executed race rather than a verdict on today.",
		],
		terms: [
			{ term: "Riegel", definition: "Scales a known race time up to the marathon distance using a fixed fatigue exponent. Simple, and optimistic for anyone under-trained for the distance." },
			{ term: "VDOT", definition: "Daniels' method: turns an effort into an estimate of aerobic power, then reads the equivalent marathon time off that." },
			{ term: "Goal pace", definition: "The average pace per kilometre your goal time requires, start to finish." },
		],
	},

	load: {
		title: "Load and risk",
		body: [
			"The single best early warning available from training data alone: how the last 7 days of load compare with the last 28. Inside the corridor, you're training at a rate your body is keeping up with. Drifting above it is where injury rates climb sharply.",
			"Ramp and long-run share describe the shape of the last whole week. Both are measured on completed weeks — the same numbers taken on a Tuesday would call every normal week a collapse.",
		],
		terms: [
			{ term: "Acute : chronic", definition: "7-day load divided by 28-day load. The 0.8–1.5 corridor is the target; above 1.5 is a spike, below 0.8 is detraining." },
			{ term: "Ramp", definition: "How much this week's distance grew over last week's. Around 10% is the conventional ceiling for adding volume safely." },
			{ term: "Long run share", definition: "What fraction of the week's distance came from the long run. Above about 35% is a week built around one run, which is a fragile way to hit a target." },
			{ term: "Load", definition: "One run's training stress, from time spent at each heart rate. It's a unitless score — only useful compared with your own other runs." },
		],
	},

	intensity: {
		title: "Intensity mix",
		body: [
			"Where your running time went over the last four weeks, split by effort. The target is roughly 80% easy — that's the ratio nearly all successful endurance programmes converge on.",
			"The band to watch is the moderate middle. Time there is the classic way to accumulate fatigue without the adaptation that either genuinely easy or genuinely hard running gives.",
		],
		terms: [
			{ term: "Easy", definition: "Heart rate zones 1–2. Conversational. Should be the overwhelming majority of your running." },
			{ term: "Moderate", definition: "Zone 3. Feels productive, costs like hard running, and buys less than either neighbour." },
			{ term: "Hard", definition: "Zones 4–5. Threshold work and intervals — valuable in small, deliberate doses." },
		],
	},

	week: {
		title: "This week",
		body: [
			"The plan for the current week, day by day, with whatever you actually ran alongside it. Volume is shown against the week's target without judgement mid-week: being at 40% on a Wednesday is on pace, not behind.",
			"A day is only marked missed once it's over, so this morning's session is still ahead of you rather than a failure.",
		],
		terms: [
			{ term: "Missed", definition: "A past day that had a run planned and none recorded." },
			{ term: "Extra", definition: "A day you ran that had no run planned." },
			{ term: "Long run", definition: "The week's long run is a single session on a single day, so it's reported as one: still ahead of you, done, or gone by. It deliberately doesn't have a progress bar — kilometres from the rest of the week aren't part of it." },
		],
	},

	runs: {
		title: "Runs this block",
		body: [
			"Every run since the block started, newest first, matched against the plan for the day it fell on. Runs on a day with a planned session are tagged with that session; anything else is an extra.",
			"Pace and grade-adjusted pace sit side by side, because on a hilly run they diverge a lot and that difference is the point — GAP is what the same effort would have been on the flat.",
		],
		terms: [
			{ term: "GAP", definition: "Grade-adjusted pace: your pace corrected for the gradient you ran it on, so hilly and flat runs can be compared." },
			{ term: "Extra", definition: "A run with no planned session on that day. Not a bad thing — just not part of the plan." },
		],
	},
};
