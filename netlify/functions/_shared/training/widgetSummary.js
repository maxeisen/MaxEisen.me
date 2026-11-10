// The slice of the /running and /cycling payloads the dashboard's widgets
// show: today's session, the last run or ride, fitness/fatigue/form, the
// race countdown, the week, and last night's recovery.
//
// Those payloads are built for full pages — run logs, weekly history,
// traces, splits — and come to tens of kilobytes. A widget polling every few
// minutes needs a couple. This picks the pieces out of what buildDashboard
// and buildCyclingDashboard already computed, so the numbers are the pages'
// numbers, and drops everything else. Pure: no Blobs, no Strava.

import { addDays, mondayOf } from "./dates.js";

const FORM_TREND_DAYS = 42;

function round(value, digits = 1) {
	if (!Number.isFinite(value)) return null;
	const scale = 10 ** digits;
	return Math.round(value * scale) / scale;
}

function form(training) {
	if (!training) return null;
	return {
		ctl: round(training.ctl),
		atl: round(training.atl),
		tsb: round(training.tsb),
		ctlDelta: round(training.ctlDelta),
		atlDelta: round(training.atlDelta),
		tsbDelta: round(training.tsbDelta),
	};
}

function formTrend(series = []) {
	return series.slice(-FORM_TREND_DAYS).map((point) => ({
		date: point.date,
		ctl: round(point.ctl),
		tsb: round(point.tsb),
	}));
}

function planned(entries = []) {
	return entries.map((entry) => ({
		type: entry.type ?? null,
		detail: entry.detail ?? null,
		distanceKm: Number.isFinite(entry.distanceKm) ? entry.distanceKm : null,
		isRun: entry.isRun === true,
	}));
}

function lastRun(run) {
	if (!run) return null;
	return {
		id: run.id,
		name: run.name ?? null,
		date: run.date ?? null,
		daysAgo: run.daysAgo ?? null,
		distanceM: run.distanceM ?? null,
		movingTimeSec: run.movingTimeSec ?? null,
		paceSecPerKm: round(run.paceSecPerKm, 0),
		averageHr: round(run.averageHr, 0),
		effort: run.effort ?? null,
	};
}

function lastRide(ride) {
	if (!ride) return null;
	return {
		id: ride.id,
		name: ride.name ?? null,
		date: ride.date ?? null,
		daysAgo: ride.daysAgo ?? null,
		distanceM: ride.distanceM ?? null,
		movingTimeSec: ride.movingTimeSec ?? null,
		elevationGainM: round(ride.elevationGainM, 0),
		averageWatts: ride.deviceWatts ? round(ride.averageWatts, 0) : null,
		weightedAverageWatts: ride.deviceWatts ? round(ride.weightedAverageWatts, 0) : null,
		averageHr: round(ride.averageHr, 0),
		effort: ride.effort ?? null,
	};
}

/** Kilometres ridden on each day of the week, from the cycling week. */
function rideKmByDay(week) {
	const byDay = {};
	for (const ride of week?.rides || []) {
		const day = ride.date || String(ride.startDateLocal || "").slice(0, 10);
		if (day) byDay[day] = (byDay[day] || 0) + (Number(ride.distanceM) || 0) / 1000;
	}
	return byDay;
}

function runSummary(running) {
	const { today, summary, week, lastRun: last } = running;
	const race = summary?.race && summary.inBlock
		? {
			label: summary.race.label ?? null,
			name: summary.race.name ?? null,
			date: summary.race.date ?? null,
			daysToRace: summary.daysToRace ?? null,
			goalTimeSec: summary.race.goalTimeSec ?? null,
			predictedSec: today?.prediction?.predictedSec ?? null,
		}
		: null;
	return {
		form: form(today?.training),
		formTrend: formTrend(running.series),
		today: today?.session
			? {
				status: today.session.status ?? null,
				planned: planned(today.session.planned),
				actualKm: round(today.session.actualKm, 2) ?? 0,
			}
			: null,
		last: lastRun(last),
		week: week
			? {
				start: week.start,
				actualKm: round(week.actualKm, 1) ?? 0,
				targetKm: round(week.targetKm, 1),
			}
			: null,
		race,
	};
}

function rideSummary(cycling) {
	const { today, week, lastRide: last } = cycling;
	return {
		form: form(today?.training),
		formTrend: formTrend(cycling.series),
		last: lastRide(last),
		week: week
			? {
				start: week.start,
				actualKm: round(week.actualKm, 1) ?? 0,
				movingTimeSec: week.movingTimeSec ?? 0,
				rides: week.rides?.length ?? 0,
			}
			: null,
	};
}

/**
 * The days of the current week, Monday first: what the running plan had
 * for each, and what was run and ridden. Between training blocks there's no
 * plan week, so the days are laid out from the calendar instead, with the
 * runs and rides alone.
 */
function weekDays(running, cycling) {
	const ridden = rideKmByDay(cycling?.week);
	const days = running?.week?.days;
	if (!Array.isArray(days) || !days.length) {
		const today = running?.today?.date ?? cycling?.today?.date;
		if (!today) return null;
		const ran = {};
		for (const run of running?.runs || []) {
			const day = run.date || String(run.startDateLocal || "").slice(0, 10);
			if (day) ran[day] = (ran[day] || 0) + (Number(run.distanceM) || 0) / 1000;
		}
		const monday = mondayOf(today);
		return Array.from({ length: 7 }, (_, i) => {
			const date = addDays(monday, i);
			return {
				date,
				isToday: date === today,
				isPast: date < today,
				planned: [],
				runKm: round(ran[date], 1) ?? 0,
				rideKm: round(ridden[date], 1) ?? 0,
			};
		});
	}
	return days.map((day) => ({
		date: day.date,
		isToday: day.isToday === true,
		isPast: day.isPast === true,
		planned: planned(day.planned),
		runKm: round(day.actualKm, 1) ?? 0,
		rideKm: round(ridden[day.date], 1) ?? 0,
	}));
}

function recoverySummary(running) {
	const readiness = running?.today?.readiness;
	const latest = running?.recovery?.latest;
	if (!readiness && !latest) return null;
	return {
		night: readiness?.night ?? latest?.day ?? null,
		value: round(readiness?.value),
		strain: readiness?.strain ?? null,
		terms: readiness?.terms
			? Object.fromEntries(Object.entries(readiness.terms).map(([k, v]) => [k, round(v)]))
			: null,
		readings: readiness?.readings ?? null,
		sleepScore: latest?.sleepScore ?? null,
		readinessScore: latest?.readinessScore ?? null,
	};
}

/**
 * @param {object} input
 * @param {object|null} input.running buildDashboard() output, or null.
 * @param {object|null} input.cycling buildCyclingDashboard() output, or null.
 * @returns {object}
 */
export function widgetSummary({ running = null, cycling = null } = {}) {
	return {
		generatedAt: new Date().toISOString(),
		run: running ? runSummary(running) : null,
		ride: cycling ? rideSummary(cycling) : null,
		week: weekDays(running, cycling),
		recovery: running ? recoverySummary(running) : null,
	};
}
