// Cycling dashboard. Same maths as running, fed only by rides. A run in the
// same blob index never enters these numbers, and a ride's load never enters
// the running series — that split lives in metrics.js and is tested there.

import { addDays, daysBetween, mondayOf, toDayKey } from "./dates.js";
import { dailyLoads } from "./load.js";
import { acwr, fitnessSeries, longRunShare, rampRate, weeklySummaries } from "./fitness.js";
import { hrZoneFloors, intensitySplit } from "./zones.js";
import { efficiencyTrend, rideEfficiency } from "./efficiency.js";
import { publicRideDetail, publicRun } from "./shape.js";
import { readiness } from "./readiness.js";
import { recoverySummary } from "./recovery.js";
import { recommendations } from "./recommend.js";
import { median } from "./stats.js";

const HARD_SHARE_PCT = 20;
const MODERATE_SHARE_PCT = 35;
const TYPICAL_WINDOW_DAYS = 42;
const INTENSITY_WINDOW_DAYS = 28;

const number = (value) => Number(value) || 0;

function isRide(activity) {
	return activity?.sport === "ride";
}

function trainingOf(series, date) {
	const idx = (series || []).findIndex((d) => d.date === date);
	if (idx < 0) return null;
	const after = series[idx];
	const before = idx > 0 ? series[idx - 1] : null;
	return {
		ctl: after.ctl,
		atl: after.atl,
		tsb: after.tsb,
		load: after.load,
		ctlDelta: before ? after.ctl - before.ctl : null,
		atlDelta: before ? after.atl - before.atl : null,
		tsbDelta: before ? after.tsb - before.tsb : null,
	};
}

function formImpact(series, date) {
	const cell = trainingOf(series, date);
	if (!cell || cell.ctlDelta === null) return null;
	return cell;
}

function zoneMix(zoneSeconds) {
	if (!Array.isArray(zoneSeconds)) return null;
	const easySec = number(zoneSeconds[0]) + number(zoneSeconds[1]);
	const moderateSec = number(zoneSeconds[2]);
	const hardSec = number(zoneSeconds[3]) + number(zoneSeconds[4]);
	const totalSec = easySec + moderateSec + hardSec;
	if (!(totalSec > 0)) return null;
	return {
		easySec,
		moderateSec,
		hardSec,
		totalSec,
		easyPct: (easySec / totalSec) * 100,
		moderatePct: (moderateSec / totalSec) * 100,
		hardPct: (hardSec / totalSec) * 100,
	};
}

function effortFromMix(mix) {
	if (!mix) return null;
	if (mix.hardPct >= HARD_SHARE_PCT) return "hard";
	if (mix.moderatePct >= MODERATE_SHARE_PCT) return "moderate";
	return "easy";
}

function loadImpact(ride, previous) {
	const load = Number.isFinite(ride.load) ? ride.load : null;
	const typical = median(previous.map((r) => number(r.load)).filter((v) => v > 0));
	return {
		load,
		typicalLoad: typical,
		vsTypicalPct: load > 0 && typical > 0 ? (load / typical) * 100 : null,
		ridesCompared: previous.length,
	};
}

/**
 * @param {object} input
 * @param {object[]} input.rides oldest first
 * @param {object[]} input.series
 * @param {string} input.today
 * @param {object} input.ride
 */
export function rideDetail({ rides, series, today, ride }) {
	if (!ride) return null;
	const date = toDayKey(ride.startDateLocal);
	const found = rides.indexOf(ride);
	const targetIdx = found < 0 ? rides.length - 1 : found;
	const from = addDays(date, -TYPICAL_WINDOW_DAYS);
	const previous = rides.slice(0, targetIdx).filter((r) => {
		const day = toDayKey(r.startDateLocal);
		return day && day >= from && day < date;
	});
	const mix = zoneMix(ride.zoneSeconds);
	return {
		...publicRideDetail(ride),
		date,
		daysAgo: daysBetween(date, today),
		ridesThatDay: rides.filter((r) => toDayKey(r.startDateLocal) === date).length,
		effort: effortFromMix(mix),
		zoneMix: mix,
		impact: {
			form: formImpact(series, date),
			load: loadImpact(ride, previous),
		},
	};
}

function riskOf(weeks, today) {
	const monday = mondayOf(today);
	const index = weeks.findIndex((w) => w.start === monday);
	const current = index >= 0 ? weeks[index] : null;
	const complete = today === addDays(monday, 6);
	const source = complete ? current : weeks[index - 1];
	const prior = complete ? weeks[index - 1] : weeks[index - 2];
	if (!source) return null;
	return {
		rampPct: rampRate(source.distanceM, prior?.distanceM ?? 0),
		longRunSharePct: longRunShare(source),
		actualKm: source.distanceM / 1000,
		previousKm: (prior?.distanceM || 0) / 1000,
		isCurrentWeek: complete,
	};
}

/**
 * @param {object} input
 * @param {object[]} input.activities
 * @param {string} input.today
 * @param {object[]} [input.recovery]
 * @param {object} [input.thresholds]
 */
export function buildCyclingDashboard({ activities = [], today, recovery = [], thresholds = {} }) {
	const day = toDayKey(today) || toDayKey(new Date());
	const sorted = [...activities].sort((a, b) => String(a.startDateLocal).localeCompare(String(b.startDateLocal)));
	const rides = sorted.filter(isRide);
	const context = sorted.filter((a) => !isRide(a));

	const loads = dailyLoads(rides);
	const first = toDayKey(rides[0]?.startDateLocal) || day;
	const series = fitnessSeries(loads, { from: first, to: day });
	const latest = series.find((d) => d.date === day) || series.at(-1) || null;

	const weeksRaw = weeklySummaries(rides, { from: first, to: day });
	const weeks = weeksRaw.map((week) => ({
		start: week.start,
		actualKm: week.distanceM / 1000,
		movingTimeSec: week.movingTimeSec,
		rideCount: week.runs,
	}));

	const recentFrom = addDays(day, -(INTENSITY_WINDOW_DAYS - 1));
	const recent = rides.filter((ride) => {
		const date = toDayKey(ride.startDateLocal);
		return date && date >= recentFrom && date <= day && Array.isArray(ride.zoneSeconds);
	});
	const intensity = intensitySplit(recent, thresholds);
	const floors = hrZoneFloors(thresholds);
	const efficiency = efficiencyTrend(rides, {
		aerobicCeilingHr: floors?.[3] ?? null,
		today: day,
		efficiencyOf: rideEfficiency,
	});

	const recovered = recovery.length ? recoverySummary(recovery, { today: day }) : null;
	const ratio = acwr(loads, day);
	const riskWeek = riskOf(weeksRaw, day);
	const advice = recommendations({
		acwr: ratio,
		latest,
		intensity,
		rampBasis: riskWeek,
		recovery: recovered,
		inBlock: false,
	}, { sport: "ride" });

	const lastRide = rideDetail({ rides, series, today: day, ride: rides.at(-1) });
	const monday = mondayOf(day);
	const weekRides = rides.filter((ride) => mondayOf(toDayKey(ride.startDateLocal)) === monday);
	const week = weekRides.length
		? {
			start: monday,
			actualKm: weekRides.reduce((sum, ride) => sum + number(ride.distanceM), 0) / 1000,
			movingTimeSec: weekRides.reduce((sum, ride) => sum + number(ride.movingTimeSec), 0),
			rides: [...weekRides].reverse().map(publicRun),
		}
		: null;

	return {
		generatedAt: new Date().toISOString(),
		today: {
			date: day,
			training: trainingOf(series, day),
			readiness: readiness({ tsb: latest?.tsb ?? null, recovery: recovered }),
		},
		summary: {
			latest,
			acwr: ratio,
			intensity,
			riskWeek,
			totals: { rides: rides.length },
		},
		series: series.filter((point) => point.date <= day),
		efficiency: { points: efficiency.points, trend: efficiency.trend },
		recovery: recovered,
		weeks,
		week,
		recommendations: advice,
		lastRide,
		activities: [...[...rides].reverse().map(publicRun), ...[...context].reverse().map(publicRun)],
	};
}

/**
 * Full detail for one stored ride. Null for a run id.
 *
 * @param {object} input
 * @param {object[]} input.activities
 * @param {string} input.today
 * @param {object} [input.thresholds]
 * @param {string|number} input.id
 */
export function rideDetailById({ activities = [], today, thresholds = {}, id }) {
	if (id == null) return null;
	const dash = buildCyclingDashboard({ activities, today, recovery: [], thresholds });
	const rides = [...activities]
		.filter(isRide)
		.sort((a, b) => String(a.startDateLocal).localeCompare(String(b.startDateLocal)));
	const ride = rides.find((item) => String(item.id) === String(id));
	if (!ride) return null;
	return rideDetail({ rides, series: dash.series, today: toDayKey(today), ride });
}
