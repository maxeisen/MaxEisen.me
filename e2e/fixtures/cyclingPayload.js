// A cycling dashboard payload the page can render without Netlify.

const MOVING_SEC = 7693;

export function buildCyclingFixture() {
	const ride = {
		id: 9001,
		sport: "ride",
		name: "Morning loop",
		startDateLocal: "2026-10-27T08:00:00",
		date: "2026-10-27",
		daysAgo: 1,
		distanceM: 62400,
		movingTimeSec: MOVING_SEC,
		elevationGainM: 418,
		averageHr: 142,
		maxHr: 168,
		averageCadence: 88,
		deviceWatts: true,
		averageWatts: 186,
		maxWatts: 412,
		weightedAverageWatts: 204,
		effort: "easy",
		trace: {
			m: [5000, 20000, 40000, 60000],
			hr: [138, 142, 150, 146],
			watts: [170, 186, 210, 190],
		},
		ridesThatDay: 1,
		impact: {
			form: { ctl: 42.1, atl: 38.4, tsb: 3.7, ctlDelta: 0.6, atlDelta: 2.1, tsbDelta: -1.5 },
			load: { load: 80, vsTypicalPct: 100, ridesCompared: 1 },
		},
	};

	return {
		generatedAt: "2026-10-28T12:00:00.000Z",
		today: {
			date: "2026-10-28",
			training: { ctl: 42.1, atl: 38.4, tsb: 3.7, ctlDelta: 0.2, atlDelta: -0.4, tsbDelta: 0.6 },
			readiness: { value: 4, terms: { form: 3.7 }, readings: { averageHrv: 62, restingHr: 46 } },
		},
		summary: {
			latest: { ctl: 42.1, atl: 38.4, tsb: 3.7 },
			acwr: { ratio: 1.05, acute: 90, chronic: 86 },
			intensity: {
				easySec: 3600,
				moderateSec: 400,
				hardSec: 200,
				totalSec: 4200,
				easyPct: 86,
				moderatePct: 9,
				hardPct: 5,
			},
			riskWeek: { rampPct: 4, longRunSharePct: 28, actualKm: 62.4, previousKm: 60, isCurrentWeek: false },
			totals: { rides: 1 },
		},
		series: [
			{ date: "2026-10-26", ctl: 41, atl: 36, tsb: 5 },
			{ date: "2026-10-27", ctl: 41.8, atl: 38, tsb: 3.8 },
			{ date: "2026-10-28", ctl: 42.1, atl: 38.4, tsb: 3.7 },
		],
		efficiency: {
			points: [
				{ date: "2026-10-20", ef: 1.28 },
				{ date: "2026-10-27", ef: 1.31 },
			],
			trend: [
				{ date: "2026-10-20", ef: 1.28 },
				{ date: "2026-10-27", ef: 1.31 },
			],
		},
		recovery: null,
		weeks: [{ start: "2026-10-19", actualKm: 62.4, movingTimeSec: MOVING_SEC }],
		week: {
			start: "2026-10-19",
			actualKm: 62.4,
			movingTimeSec: MOVING_SEC,
			rides: [ride],
		},
		recommendations: [{
			id: "acwr-ok",
			severity: "good",
			title: "Load is in a sensible place",
			detail: "The last week of riding sits inside the corridor.",
		}],
		lastRide: ride,
		activities: [ride],
		sync: { hasSynced: true, lastRunAt: "2026-10-28T12:00:00.000Z", outstanding: 0 },
	};
}
