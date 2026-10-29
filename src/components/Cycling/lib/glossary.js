// Copy behind each cycling panel's "i" button. Thresholds match the engine.

export const GLOSSARY = {
	today: {
		title: "Today",
		body: [
			"Cycling fitness, fatigue and form against yesterday, plus readiness. Readiness never feeds the load model. It is cycling form together with last night's sleep, heart-rate variability and resting heart rate against a 28-day baseline.",
		],
		terms: [
			{ term: "Training", definition: "Today's cycling fitness, fatigue and form. A rest day still moves them, because fatigue fades faster than fitness. Only rides change the load." },
			{ term: "Readiness", definition: "A signed number like form. Last night does not change until tomorrow. A ride moves readiness only through form." },
		],
	},
	lastRide: {
		title: "Last ride",
		body: [
			"The most recent ride: distance, moving time, climb and average speed, then power, heart rate and cadence when they were recorded.",
			"Power is shown only when a meter recorded it. Estimated watts are left out. Cadence is revolutions per minute. Two rides on one day share that day's fitness change, and the card says so.",
		],
		terms: [
			{ term: "Load", definition: "Training stress from time spent at each heart rate. A ride with no heart rate is listed and does not move fitness. Compared with your own rides from the last six weeks." },
			{ term: "Fitness, fatigue and form", definition: "What the day's riding moved. Fitness is the 42-day average of load, fatigue the 7-day one, form the difference." },
		],
	},
	recommendations: {
		title: "Recommendations",
		body: [
			"The same restraint rules as the other dashboard, written for riding. Each card shows the number that crossed a threshold.",
		],
		terms: [
			{ term: "Load ratio", definition: "The last 7 days of ride load divided by the last 28. The corridor is 0.8 to 1.5." },
			{ term: "Long ride share", definition: "How much of the week's distance sat in the longest ride. Above 35% is a lot to put in one day." },
		],
	},
	volume: {
		title: "Weekly volume",
		body: [
			"Kilometres and hours ridden, week by week. Weeks start on Monday. There is no plan target on this chart.",
		],
	},
	fitness: {
		title: "Fitness and fatigue",
		body: [
			"Fitness is the 42-day average of ride load, fatigue the 7-day average, and form is the difference. Rides are the only input.",
		],
	},
	efficiency: {
		title: "Aerobic efficiency",
		body: [
			"Watts per heartbeat on easier rides that recorded meter power. Estimated watts are not plotted. Rides without a meter are skipped. The direction of the line is the point.",
		],
	},
	week: {
		title: "This week",
		body: [
			"Rides so far in the current Monday-to-Sunday week, with the distance and moving time they add up to.",
		],
	},
	load: {
		title: "Load and risk",
		body: [
			"This week's ride load against the last four weeks. The safe corridor is 0.8 to 1.5. A week-to-week ramp above 10%, or a longest ride above 35% of the week, is flagged.",
		],
	},
	recovery: {
		title: "Recovery",
		body: [
			"Sleep and overnight heart rate from the ring. The same nights the other dashboard reads. They are not written into cycling fitness.",
		],
	},
	intensity: {
		title: "Intensity mix",
		body: [
			"Where riding time went over the last four weeks, by heart-rate zone. Easy is zones 1–2, moderate is zone 3, hard is zones 4–5. The easy share to hold is about 80%.",
		],
	},
	rides: {
		title: "Recent activity",
		body: [
			"Rides are the rows that open here. Other activities are listed for context and count toward nothing on this page.",
		],
	},
};
