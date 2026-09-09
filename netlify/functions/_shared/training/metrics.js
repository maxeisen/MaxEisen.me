// Assemble the full dashboard payload from the engine modules.
//
// This is the only place the pieces meet, and it stays a pure function of
// (activities, plan, today) so the whole dashboard can be exercised in tests
// without Strava, Blobs, or a clock.

import { dailyLoads } from "./load.js";
import { acwr, fitnessGain, fitnessSeries, longRunShare, rampRate, weeklySummaries } from "./fitness.js";
import { hrZoneFloors, intensitySplit } from "./zones.js";
import { efficiencyTrend } from "./efficiency.js";
import { collectBestEfforts, isRunActivity, publicRun } from "./shape.js";
import { lastRunDetail } from "./lastRun.js";
import { todayBriefing } from "./today.js";
import { goalDelta, goalPaceSecPerKm, predictRace } from "./predict.js";
import {
	blockRange,
	comparePlan,
	currentWeek as findCurrentWeek,
	dayOfWeek,
	daysToRace,
	matchRunsToPlan,
	upcomingWeeks,
	weekDays,
	weekLongRun,
	weeksToRace,
} from "./plan.js";
import { recommendations } from "./recommend.js";
import { recoverySummary } from "./recovery.js";
import { strainSignal } from "./response.js";
import { toDayKey } from "./dates.js";

// How far back the intensity distribution looks. A whole block averages away
// the thing you'd act on; four weeks reflects current habits.
const INTENSITY_WINDOW_DAYS = 28;

// Long runs considered when reporting decoupling.
const LONG_RUN_MIN_M = 18000;

// How many runs the log carries. Enough to scroll through a couple of months
// of training without shipping the whole block's history to every visitor.
const RUN_LOG_LIMIT = 30;

function withinDays(activities, today, days) {
	const cutoff = new Date(`${today}T00:00:00Z`).getTime() - days * 86_400_000;
	return activities.filter((a) => {
		const day = toDayKey(a.startDateLocal);
		return day && new Date(`${day}T00:00:00Z`).getTime() >= cutoff;
	});
}

function planDays(week, runs, today) {
	if (!week?.start) return [];
	const done = new Map();
	for (const run of runs) {
		const day = toDayKey(run.startDateLocal);
		if (!day) continue;
		if (!done.has(day)) done.set(day, []);
		done.get(day).push(run);
	}

	return weekDays(week.start).map((date) => {
		const actual = done.get(date) || [];
		return {
			date,
			isToday: date === today,
			isPast: date < today,
			planned: (week.sessions || []).map((s) => ({
				type: s.type,
				detail: s.detail,
				distanceKm: Number.isFinite(Number(s.distanceKm)) ? Number(s.distanceKm) : null,
				isRun: s.isRun === true,
				date: s.date,
			})).filter((s) => s.date === date),
			actualKm: actual.reduce((sum, r) => sum + (Number(r.distanceM) || 0), 0) / 1000,
			runs: actual.length,
		};
	});
}

/** Latest runs (plus rides/strength across the same span, as context only). */
function recentLog(runs, context, planMatches) {
	const from = Math.max(0, runs.length - RUN_LOG_LIMIT);
	const logged = runs
		.slice(from)
		.map((run, i) => ({ ...publicRun(run), plan: planMatches[from + i] }));
	const earliest = toDayKey(logged[0]?.startDateLocal);
	const alongside = earliest
		? context.filter((r) => toDayKey(r.startDateLocal) >= earliest).map(publicRun)
		: [];
	return [...logged, ...alongside]
		.sort((a, b) => String(a.startDateLocal).localeCompare(String(b.startDateLocal)))
		.reverse();
}

/**
 * Build the dashboard payload.
 *
 * @param {object} input
 * @param {object[]} input.activities shaped activities, any order.
 * @param {object} input.plan parsed marathon-plan.json.
 * @param {string} input.today day key.
 * @param {object[]} [input.recovery] shaped nights from the Oura ring. Optional
 *   throughout: the page predates it and reads the same without it.
 * @returns {object}
 */
export function buildDashboard({ activities = [], plan = {}, today, recovery = [] }) {
	const day = toDayKey(today) || toDayKey(new Date());
	const sorted = [...activities].sort((a, b) =>
		String(a.startDateLocal).localeCompare(String(b.startDateLocal)),
	);

	// Rides and gym sessions reach the log and nothing else. Feeding them
	// into fatigue alone was tried and reverted: form is fitness minus
	// fatigue, so raising one without the other pushes form permanently
	// negative. Letting them earn fitness too would read cycling as
	// marathon fitness.
	const runs = sorted.filter(isRunActivity);
	const context = sorted.filter((a) => !isRunActivity(a));

	const thresholds = plan?.thresholds || {};
	const race = plan?.race || {};
	const range = blockRange(plan, runs, day);

	const loads = dailyLoads(runs);
	const series = range ? fitnessSeries(loads, range) : [];
	// Report against today, not the end of the block — the series runs forward
	// to race day, where CTL has decayed to nothing because no runs exist yet.
	const latest = series.find((d) => d.date === day) || series.at(-1) || null;
	const ratio = acwr(loads, day);

	const weeks = comparePlan(
		weeklySummaries(runs, range || {}),
		plan,
	).map((week, i, all) => {
		const previous = all[i - 1];
		return {
			...week,
			rampPct: rampRate(week.distanceM, previous?.distanceM ?? 0),
			longRunSharePct: longRunShare(week),
		};
	});

	const current = findCurrentWeek(weeks, day);
	const currentIndex = current ? weeks.indexOf(current) : -1;
	const previous = currentIndex > 0 ? weeks[currentIndex - 1] : null;
	const weekComplete = dayOfWeek(day) >= 7;

	// Week-over-week ramp and long-run share are only meaningful across whole
	// weeks. Measured on a Tuesday, a perfectly normal week reads as a 100%
	// collapse in volume purely because most of it hasn't happened yet, so
	// mid-week these describe the last completed week instead.
	const riskWeek = weekComplete ? current : previous;

	const recentRuns = withinDays(runs, day, INTENSITY_WINDOW_DAYS);
	const intensity = intensitySplit(recentRuns, thresholds);

	// Zone 4 is where an effort stops being aerobic, which is the line the
	// efficiency trend needs in order to compare like with like.
	const zoneFloors = hrZoneFloors(thresholds);
	const efficiency = efficiencyTrend(runs, {
		aerobicCeilingHr: zoneFloors?.[3] ?? null,
		today: day,
	});

	// Deliberately computed after everything above it and read by none of it.
	// Recovery is the one input here that isn't training load, and the fitness
	// model stays a closed system fed only by load — see recovery.js.
	const recovered = recoverySummary(recovery, { today: day });

	// The two sources meet here and nowhere else, which is the whole point of
	// this file. Reading them against each other costs the separation nothing:
	// every number above is already final, and what response.js adds is whether
	// the body agrees with the training log about how tired it is.
	const response = recovered
		? { strain: strainSignal({ tsb: latest?.tsb ?? null, recovery: recovered }) }
		: null;

	const raceDistanceM = race.distanceM || 42195;
	const efforts = collectBestEfforts(runs);
	const prediction = predictRace(efforts, raceDistanceM);
	const goalPace = goalPaceSecPerKm(race.goalTimeSec, raceDistanceM);
	const delta = prediction ? goalDelta(prediction.predictedSec, race.goalTimeSec) : null;

	const lastLongRun = [...runs]
		.reverse()
		.find((a) => a.distanceM >= LONG_RUN_MIN_M && Number.isFinite(a.decouplingPct));

	// Matched over the whole block rather than per view: a day whose first run
	// falls outside the log would otherwise let its second run claim the
	// session the first one already did.
	const planMatches = matchRunsToPlan(runs, plan);

	const lastRun = lastRunDetail({
		runs,
		series,
		weeks,
		planMatch: planMatches.at(-1) ?? null,
		thresholds,
		today: day,
	});

	const days = current ? planDays(current, runs, day) : [];
	const actualToday = runs.filter((r) => toDayKey(r.startDateLocal) === day);
	const todayRow = days.find((d) => d.date === day) || {
		date: day,
		planned: [],
		actualKm: actualToday.reduce((sum, r) => sum + (Number(r.distanceM) || 0), 0) / 1000,
		runs: actualToday.length,
	};

	const remainingDays = daysToRace(plan, day);
	const totals = runs.reduce(
		(acc, a) => {
			acc.distanceM += a.distanceM || 0;
			acc.movingTimeSec += a.movingTimeSec || 0;
			acc.runs += 1;
			return acc;
		},
		{ distanceM: 0, movingTimeSec: 0, runs: 0 },
	);

	const summary = {
		race: {
			name: race.name || null,
			date: race.date || null,
			distanceM: race.distanceM || 42195,
			goalTimeSec: race.goalTimeSec || null,
			goalPaceSecPerKm: goalPace,
		},
		daysToRace: remainingDays,
		weeksToRace: weeksToRace(plan, day),
		totals,
		latest: latest
			? {
					date: latest.date,
					ctl: latest.ctl,
					atl: latest.atl,
					tsb: latest.tsb,
					// What the fitness number is actually for. See fitnessGain.
					ctlGain: fitnessGain(series, day),
				}
			: null,
		acwr: ratio,
		intensity,
		riskWeek: riskWeek
			? {
					start: riskWeek.start,
					rampPct: riskWeek.rampPct,
					longRunSharePct: riskWeek.longRunSharePct,
					// Lets the UI label these "this week" or "last week"
					// rather than quietly describing a different week.
					isCurrentWeek: weekComplete,
				}
			: null,
		prediction: prediction
			? {
					predictedSec: prediction.predictedSec,
					riegelSec: prediction.riegelSec,
					vdotSec: prediction.vdotSec,
					vdot: prediction.vdot,
					basis: prediction.basis,
					deltaSec: delta?.deltaSec ?? null,
					onTrack: delta?.onTrack ?? null,
				}
			: null,
		longRun: lastLongRun
			? {
					id: lastLongRun.id,
					name: lastLongRun.name,
					date: toDayKey(lastLongRun.startDateLocal),
					distanceM: lastLongRun.distanceM,
					decouplingPct: lastLongRun.decouplingPct,
				}
			: null,
		efficiency: {
			changePct: efficiency.changePct,
			first: efficiency.first,
			latest: efficiency.latest,
			runs: efficiency.points.length,
		},
	};

	const advice = recommendations({
		acwr: ratio,
		latest: summary.latest || {},
		intensity,
		currentWeek: current
			? {
					...current,
					// Only judge a week's volume against plan once it's actually over.
					weekComplete,
				}
			: null,
		// Ramp and long-run share are shape-of-the-week measures, so they're
		// judged on the last whole week. Carrying the volumes alongside them
		// keeps the advice text describing the same week as its metric.
		rampBasis: riskWeek
			? {
					rampPct: riskWeek.rampPct,
					longRunSharePct: riskWeek.longRunSharePct,
					actualKm: riskWeek.actualKm,
					previousKm: weekComplete ? previous?.actualKm : weeks[currentIndex - 2]?.actualKm,
					isCurrentWeek: weekComplete,
				}
			: null,
		prediction: summary.prediction,
		goal: { goalTimeSec: race.goalTimeSec, goalPaceSecPerKm: goalPace },
		daysToRace: remainingDays,
		longRunDecouplingPct: lastLongRun?.decouplingPct ?? null,
		recovery: recovered,
		// Form on its own can only repeat what the training log told it. This
		// is whether the body's own markers agree, which is the difference
		// between "you're absorbing a big block" and "stop".
		strain: response?.strain ?? null,
	});

	const briefing = todayBriefing({
		date: day,
		series,
		day: todayRow,
		recovery: recovered,
		efforts,
		targetDistanceM: raceDistanceM,
	});

	return {
		generatedAt: new Date().toISOString(),
		today: briefing,
		summary,
		series: series.filter((d) => d.date <= day),
		efficiency: { points: efficiency.points, trend: efficiency.trend },
		recovery: recovered ? { ...recovered, response } : null,
		weeks,
		week: current
			? {
					...current,
					days,
					longRun: weekLongRun(current, runs, day),
				}
			: null,
		upcoming: upcomingWeeks(plan, day),
		recommendations: advice,
		lastRun,
		runs: recentLog(runs, context, planMatches),
		thresholds,
	};
}
