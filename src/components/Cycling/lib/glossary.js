// Copy behind each cycling panel's "?" button. Thresholds match the engine.
// Same house style as the running glossary (Training/lib/glossary.js), and
// written to stand on its own: nothing here refers to the running page.

export const GLOSSARY = {
	today: {
		title: "Today",
		body: [
			"Where things stand this morning. Fitness, fatigue and form come from ride load alone. Readiness is a separate read of how your body is coping, and never feeds back into them.",
		],
		terms: [
			{ term: "Training", definition: "How cycling fitness, fatigue and form changed since yesterday. Rest days move them too: fatigue fades faster than fitness, so form usually rises." },
			{ term: "Readiness", definition: "A signed number like form, built from form plus last night's sleep, HRV and resting heart rate against your 28-day baseline. It updates once a night; a ride only moves it through form." },
		],
	},
	lastRide: {
		title: "Last ride",
		body: [
			"Your most recent ride: distance, time, climb and speed, then power, heart rate and cadence when they were recorded.",
			"The chart shows power along the ride when a power meter recorded it, with heart rate on the right-hand scale. Estimated power isn't shown.",
		],
		terms: [
			{ term: "Load", definition: "Training stress from time spent at each heart rate, compared with your rides from the last six weeks. A ride without heart rate doesn't change fitness." },
			{ term: "Fitness, fatigue and form", definition: "What the day's riding changed. Two rides on one day share that day's change." },
		],
	},
	recommendations: {
		title: "Recommendations",
		body: [
			"A fixed set of rules reads the numbers on this page and flags anything worth acting on. Each card shows the value that triggered it beside the threshold it crossed.",
			"Most rules are about holding back: ramping too fast, riding easy days too hard, or not recovering.",
		],
		terms: [
			{ term: "Load ratio", definition: "Your last 7 days of ride load divided by your last 28. Aim for 0.8–1.5." },
			{ term: "Long ride share", definition: "How much of the week's distance came from the longest ride. Above 35% leans too hard on one day." },
		],
	},
	volume: {
		title: "Weekly volume",
		body: [
			"Kilometres ridden each week, Monday to Sunday.",
		],
	},
	fitness: {
		title: "Fitness and fatigue",
		body: [
			"Every ride gets a training-load score from heart rate and duration. Fitness is the 42-day average of that score, fatigue the 7-day average, and form the gap between them. Fitness uses the right-hand scale so a slow build stays visible.",
		],
	},
	efficiency: {
		title: "Aerobic efficiency",
		body: [
			"Power per heartbeat on easier rides with a power meter. A rising line means the same effort is producing more power. Rides without a meter are left out.",
		],
	},
	week: {
		title: "This week",
		body: [
			"Rides so far this week, Monday to Sunday, with their total distance and time.",
		],
	},
	load: {
		title: "Load and risk",
		body: [
			"Your last 7 days of ride load against your last 28. The safe corridor is 0.8 to 1.5. A week-on-week jump over 10%, or one ride carrying more than 35% of the week, gets flagged.",
		],
	},
	recovery: {
		title: "Recovery",
		body: [
			"Sleep and overnight heart rate from an Oura ring, comparing the last 7 nights with your 28-day normal. It doesn't feed cycling fitness; it's a second opinion on how you're coping with the training.",
		],
	},
	intensity: {
		title: "Intensity mix",
		body: [
			"Where your riding time went over the last four weeks, by heart-rate zone: easy is zones 1–2, moderate zone 3, hard zones 4–5. Aim for about 80% easy.",
		],
	},
	rides: {
		title: "Recent activity",
		body: [
			"Your recent rides, newest first. Open one for the full detail. Other activities are listed for context and don't count toward anything here.",
		],
	},
};
