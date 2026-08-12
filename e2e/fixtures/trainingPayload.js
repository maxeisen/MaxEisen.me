// A full /training payload, built without Strava or Blobs.
//
// The E2E suite runs against `vite preview`, which serves no Netlify Functions,
// so /training would otherwise render its "couldn't load" state — and the parts
// of the page most likely to break a phone (the charts, the week grid, the run
// log) are exactly the parts that only exist once there's data. The metrics
// engine is a pure function of (activities, plan, today), so a synthetic block
// run through the real engine gives the page a realistic payload to lay out.

import { shapeActivities } from "../../netlify/functions/_shared/training/shape.js";
import { buildDashboard } from "../../netlify/functions/_shared/training/metrics.js";
import { loadPlan } from "../../netlify/functions/_shared/training/planFile.js";

// Strava's field names are quoted throughout: they're the API's spelling rather
// than identifiers this repo chose, and quoting says so — to a reader and to
// the analyser, which otherwise reads every one of them as a naming mistake.

// A deterministic generator, so a layout assertion can never fail on a Tuesday
// only because that week's random distances happened to be long.
function sequence(seed = 42) {
	let value = seed;
	return () => {
		value = (value * 1103515245 + 12345) % 2147483648;
		return value / 2147483648;
	};
}

const NAMES = [
	"Morning Run",
	"Lunch Run",
	"Evening Run",
	"Tempo — On Off Ks",
	"Recovery Shakeout",
];

// A minute-by-minute recording of one run, which is what the sync derives time
// in zones and aerobic drift from (see shape.js). Without one, those are null
// and the last-run panel renders its "no heart rate" path — real for a manual
// entry, but not what the page normally shows.
function streamsFor({ distance, movingTime, averageHr, next }) {
	const steps = Math.max(20, Math.round(movingTime / 60));
	const time = [];
	const distanceStream = [];
	const heartrate = [];
	const grade = [];

	for (let i = 0; i <= steps; i++) {
		time.push(Math.round((movingTime / steps) * i));
		distanceStream.push((distance / steps) * i);
		// Drifting up through the run, the way heart rate does at a fixed
		// effort, plus enough noise to land either side of a zone floor.
		heartrate.push(averageHr - 6 + (12 * i) / steps + (next() - 0.5) * 6);
		grade.push((next() - 0.5) * 3);
	}
	return { time, distance: distanceStream, heartrate, "grade_smooth": grade };
}

/**
 * @param {object} [options]
 * @param {string} [options.today] day key the dashboard is built against.
 * @returns {object} the same shape trainingData serves.
 */
export function buildTrainingFixture({ today = "2026-08-11" } = {}) {
	const plan = loadPlan();
	const next = sequence();
	const raw = [];
	let id = 900000;

	const start = new Date(`${plan.weeks[0].start}T00:00:00Z`);
	const end = new Date(`${today}T00:00:00Z`);
	for (const day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
		const dow = day.getUTCDay();
		if (dow === 1 || dow === 6) continue; // strength / rest
		const isLong = dow === 0;
		const distance = isLong ? 16000 + next() * 8000 : 6000 + next() * 6000;
		const paceSecPerKm = isLong ? 330 + next() * 25 : 300 + next() * 40;
		const movingTime = Math.round((distance / 1000) * paceSecPerKm);
		const date = day.toISOString().slice(0, 10);
		const averageHr = 138 + next() * 22;

		raw.push({
			id: id++,
			// Deliberately long enough to test that a run title truncates
			// rather than widening the log.
			name: isLong ? "Long Run Along the Lakeshore Trail" : NAMES[Math.floor(next() * NAMES.length)],
			type: "Run",
			"sport_type": "Run",
			private: false,
			"start_date_local": `${date}T07:12:00Z`,
			distance,
			"moving_time": movingTime,
			"elapsed_time": movingTime + 90,
			"total_elevation_gain": Math.round(next() * 120),
			"average_heartrate": averageHr,
			"max_heartrate": 172 + next() * 15,
			"average_cadence": 84 + next() * 6,
			"workout_type": isLong ? 2 : dow === 5 ? 3 : 0,
			// Whole kilometres, then the fragment Strava sends for however far
			// past the last one you actually got. Real runs almost never end on
			// a round number, and that stub's pace is where the panel's chart
			// went wrong the first time.
			"splits_metric": Array.from({ length: Math.ceil(distance / 1000) }, (_, i) => {
				const splitM = Math.min(1000, distance - i * 1000);
				return {
					distance: splitM,
					"moving_time": Math.round((paceSecPerKm + (next() - 0.5) * 20) * (splitM / 1000)),
					"elevation_difference": Math.round((next() - 0.5) * 12),
					"average_heartrate": 140 + next() * 20,
				};
			}),
			"best_efforts": [
				{ name: "5k", distance: 5000, "elapsed_time": Math.round(paceSecPerKm * 5 * 0.92) },
				{ name: "10k", distance: 10000, "elapsed_time": Math.round(paceSecPerKm * 10 * 0.95) },
			],
			streams: streamsFor({ distance, movingTime, averageHr, next }),
		});
	}

	return {
		...buildDashboard({
			// Streams are per-activity here, where the real sync fetches them
			// one run at a time; shapeActivities takes one set for the batch,
			// so shape each run with its own.
			activities: raw
				.map(({ streams, ...activity }) =>
					shapeActivities([activity], { streams, thresholds: plan.thresholds })[0])
				.filter(Boolean),
			plan,
			today,
		}),
		sync: { lastRunAt: `${today}T12:00:00.000Z`, hasSynced: true, outstanding: 0, backfilling: false },
	};
}
