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

// A second-by-second recording of one run, which is what the sync derives time
// in zones, aerobic drift and the pace/heart-rate trace from (see shape.js).
// Without one, those are null and the last-run panel renders its "no heart
// rate" path — real for a manual entry, but not what the page normally shows.
//
// Every five seconds rather than every minute, for two reasons. The trace
// resamples in slices of a hundred and fifty metres, and a sample a minute
// apart is a sample every quarter kilometre, which would leave most of those
// slices unmeasured and the chart a dotted line through a run that never
// paused. And anything sparser than ten seconds is a hole in the recording as
// far as streams.js is concerned, so a run sampled by the minute would arrive
// with no time in any zone at all.
//
// It draws from a generator of its own, seeded from the shared one. Drawing
// directly would tie the sequence every other activity is built from to how
// many samples this run happens to take, so changing the sample rate would
// silently rewrite the whole block — different distances, a different last
// run, and a handful of unrelated assertions to re-baseline.
function streamsFor({ distance, movingTime, averageHr, next }) {
	const noise = sequence(Math.floor(next() * 2147483648));
	const steps = Math.max(20, Math.round(movingTime / 5));
	const time = [];
	const distanceStream = [];
	const heartrate = [];
	const grade = [];

	for (let i = 0; i <= steps; i++) {
		time.push(Math.round((movingTime / steps) * i));
		distanceStream.push((distance / steps) * i);
		// Drifting up through the run, the way heart rate does at a fixed
		// effort, plus enough noise to land either side of a zone floor.
		heartrate.push(averageHr - 6 + (12 * i) / steps + (noise() - 0.5) * 6);
		grade.push((noise() - 0.5) * 3);
	}
	return { time, distance: distanceStream, heartrate, "grade_smooth": grade };
}

// A month of nights, already shaped the way the sync stores them. Enough for
// the baselines to exist, and varied enough that the panel's chart has
// something to draw and at least one night falls under the seven-hour line —
// a fixture of identical perfect nights would pass a rendering test while
// hiding whether the "short night" case draws at all.
function nightsUpTo(today, next) {
	const end = new Date(`${today}T00:00:00Z`);
	return Array.from({ length: 28 }, (_, i) => {
		const day = new Date(end);
		day.setUTCDate(day.getUTCDate() - (27 - i));
		const sleepSec = Math.round((6.2 + next() * 2.2) * 3600);
		return {
			day: day.toISOString().slice(0, 10),
			sleepSec,
			efficiencyPct: Math.round(86 + next() * 8),
			restingHr: Math.round(45 + next() * 5),
			averageHrv: Math.round(55 + next() * 20),
			sleepScore: Math.round(70 + next() * 22),
			readinessScore: Math.round(70 + next() * 22),
		};
	});
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
		if (dow === 1) continue; // strength
		const date = day.toISOString().slice(0, 10);

		// Saturday is a ride. It's here so the log renders one: a ride reaches
		// that list and no metric on the page, and a fixture of nothing but
		// runs can't tell the difference between that working and the ride
		// support having quietly disappeared.
		if (dow === 6) {
			const rideDistance = 45000 + next() * 25000;
			raw.push({
				id: id++,
				name: "Saturday Ride",
				type: "Ride",
				"sport_type": "Ride",
				private: false,
				"start_date_local": `${date}T09:00:00Z`,
				distance: rideDistance,
				// Around 25–30 km/h, which is the number the row shows.
				"moving_time": Math.round(rideDistance / (7 + next())),
				"total_elevation_gain": Math.round(next() * 400),
				"average_heartrate": 132 + next() * 12,
			});
			continue;
		}

		const isLong = dow === 0;
		const distance = isLong ? 16000 + next() * 8000 : 6000 + next() * 6000;
		const paceSecPerKm = isLong ? 330 + next() * 25 : 300 + next() * 40;
		const movingTime = Math.round((distance / 1000) * paceSecPerKm);
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
			recovery: nightsUpTo(today, next),
			today,
		}),
		sync: { lastRunAt: `${today}T12:00:00.000Z`, hasSynced: true, outstanding: 0, backfilling: false },
	};
}
