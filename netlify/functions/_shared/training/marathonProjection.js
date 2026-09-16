// Training-aware marathon projection.
//
// Race equivalence lives in predict.js and answers "what marathon would this
// 10k imply for a similarly trained runner?" This module asks a different
// question: what finish does the current block actually support? Tanda's
// eight-week trailing volume-and-pace model is the training estimate; Riegel/VDOT on
// recent race-quality efforts are the aerobic ceiling. Recovery widens the
// range rather than inventing seconds of ability.

import { addDays, daysBetween, mondayOf, toDayKey } from "./dates.js";
import { TSB_FATIGUE } from "./fitness.js";
import { goalDelta, predictRace } from "./predict.js";
import { collectBestEfforts } from "./shape.js";

const MARATHON_M = 42195;
const TRAINING_WEEKS = 8;
const RECENT_EFFORT_DAYS = 84;
const TANDA_RMSE_SEC = 5.4 * 60;
const LONG_RUN_M = 18_000;
const CONTAINED_FRACTION = 0.8;
const RACE = 1;
const WORKOUT = 3;
const TSB_FRESH = 5;

function isRun(activity) {
	return activity?.sport !== "ride" && activity?.sport !== "strength";
}

/**
 * An effort that can stand in for a race: tagged races and workouts, or a
 * whole-run time trial. Contained splits of easy and long runs are training
 * evidence, not a new 10k PR.
 *
 * @param {object} effort
 * @returns {boolean}
 */
export function isRaceQualityEffort(effort) {
	const dist = Number(effort?.distanceM);
	if (!(dist >= 5000)) return false;
	const workoutType = Number(effort?.workoutType);
	const isRace = workoutType === RACE;
	const isWorkout = workoutType === WORKOUT;
	const parentDist = Number(effort?.activityDistanceM) > 0 ? Number(effort.activityDistanceM) : dist;
	const contained = dist < parentDist * CONTAINED_FRACTION;
	const isLong = parentDist >= LONG_RUN_M;
	if (isLong && !isRace) return false;
	if (contained && !isRace && !isWorkout) return false;
	return true;
}

function qualityEfforts(efforts) {
	return (efforts || []).filter(isRaceQualityEffort);
}

/**
 * Tanda training-only marathon estimate.
 *
 * @param {object[]} runs shaped activities.
 * @param {string} today day key.
 * @param {number} [targetDistanceM]
 * @returns {object|null}
 */
export function trainingProjection(runs, today, targetDistanceM = MARATHON_M) {
	const end = toDayKey(today);
	const from = addDays(end, -(TRAINING_WEEKS * 7 - 1));
	if (!end || !from) return null;

	const bins = Array.from({ length: TRAINING_WEEKS }, (_, index) => {
		const start = addDays(from, index * 7);
		return { start, end: addDays(start, 6), distanceM: 0, movingTimeSec: 0 };
	});

	for (const activity of runs || []) {
		if (!isRun(activity)) continue;
		const day = toDayKey(activity?.startDateLocal);
		if (!day || day < from || day > end) continue;
		const bin = bins.find((week) => day >= week.start && day <= week.end);
		if (!bin) continue;
		bin.distanceM += Number(activity.distanceM) || 0;
		bin.movingTimeSec += Number(activity.movingTimeSec) || 0;
	}

	const totals = bins.reduce(
		(sum, week) => ({
			distanceM: sum.distanceM + week.distanceM,
			movingTimeSec: sum.movingTimeSec + week.movingTimeSec,
		}),
		{ distanceM: 0, movingTimeSec: 0 },
	);
	if (!(totals.distanceM > 0) || !(totals.movingTimeSec > 0)) return null;

	const averageKmPerWeek = totals.distanceM / 1000 / TRAINING_WEEKS;
	const averagePaceSecPerKm = totals.movingTimeSec / (totals.distanceM / 1000);
	const predictedPaceSecPerKm =
		17.1 + 140 * Math.exp(-0.0053 * averageKmPerWeek) + 0.55 * averagePaceSecPerKm;
	const weeksWithRuns = bins.filter((week) => week.distanceM > 0).length;

	return {
		weeks: TRAINING_WEEKS,
		weeksWithRuns,
		averageKmPerWeek,
		averagePaceSecPerKm,
		predictedPaceSecPerKm,
		predictedSec: predictedPaceSecPerKm * (targetDistanceM / 1000),
	};
}

function evidenceFactors(runs, training, basisStatus, today) {
	const recentRuns = (runs || []).filter((activity) => {
		if (!isRun(activity)) return false;
		const age = daysBetween(toDayKey(activity?.startDateLocal), today);
		return Number.isFinite(age) && age >= 0 && age <= RECENT_EFFORT_DAYS;
	});
	const averageKm = training?.averageKmPerWeek ?? null;
	const volumeTone =
		averageKm === null ? "insufficient" : averageKm >= 50 ? "supporting" : averageKm >= 40 ? "neutral" : "limiting";
	const longestKm = recentRuns.reduce(
		(max, activity) => Math.max(max, (Number(activity.distanceM) || 0) / 1000),
		0,
	);
	const longRunTone =
		longestKm >= 30 ? "supporting" : longestKm >= 25 ? "neutral" : longestKm > 0 ? "limiting" : "insufficient";
	const durabilitySamples = recentRuns
		.filter((activity) => Number(activity.distanceM) >= LONG_RUN_M)
		.map((activity) => Number(activity.decouplingPct))
		.filter(Number.isFinite);
	const decouplingPct =
		durabilitySamples.length > 0
			? durabilitySamples.reduce((sum, value) => sum + value, 0) / durabilitySamples.length
			: null;
	const durabilityTone =
		decouplingPct === null ? "insufficient" : decouplingPct <= 3 ? "supporting" : decouplingPct <= 5 ? "neutral" : "limiting";
	const activeWeeks = training?.weeksWithRuns ?? 0;
	const consistencyTone =
		!training ? "insufficient" : activeWeeks >= 8 ? "supporting" : activeWeeks >= 6 ? "neutral" : "limiting";

	return [
		{
			id: "volume",
			label: "Eight-week volume",
			value: averageKm === null ? null : `${averageKm.toFixed(1)} km/week`,
			tone: volumeTone,
		},
		{
			id: "long-runs",
			label: "Longest recent run",
			value: longestKm > 0 ? `${longestKm.toFixed(1)} km` : null,
			tone: longRunTone,
		},
		{
			id: "durability",
			label: "Long-run decoupling",
			value: decouplingPct === null ? null : `${decouplingPct.toFixed(1)}%`,
			tone: durabilityTone,
		},
		{
			id: "consistency",
			label: "Training consistency",
			value: training ? `${activeWeeks} of 8 weeks` : null,
			tone: consistencyTone,
		},
		{
			id: "aerobic-basis",
			label: "Race-effort basis",
			value: basisStatus || null,
			tone: basisStatus === "recent" ? "supporting" : basisStatus === "historic" ? "limiting" : "insufficient",
		},
	];
}

function recoverySpreadSec(tsb) {
	if (!Number.isFinite(tsb)) return 0;
	if (tsb <= TSB_FATIGUE) return 180;
	if (tsb < -10) return 60;
	return 0;
}

function confidenceOf(factors, tsb) {
	const adjustment = { supporting: 8, neutral: 0, limiting: -8, insufficient: -10 };
	let score = 50 + factors.reduce((sum, factor) => sum + (adjustment[factor.tone] || 0), 0);
	if (Number.isFinite(tsb)) {
		if (tsb <= TSB_FATIGUE) score -= 12;
		else if (tsb >= TSB_FRESH) score += 6;
	}
	score = Math.max(20, Math.min(90, score));
	return {
		score,
		label: score >= 70 ? "high" : score >= 45 ? "moderate" : "low",
	};
}

function rangeOf(predictedSec, training, recentAerobic, factors, tsb) {
	const limiting = factors.filter((factor) => factor.tone === "limiting").length;
	const insufficient = factors.filter((factor) => factor.tone === "insufficient").length;
	const modelGap =
		training && recentAerobic
			? Math.abs(training.predictedSec - recentAerobic.predictedSec) / 2
			: 0;
	const base = training ? TANDA_RMSE_SEC : predictedSec * 0.05;
	const spread =
		Math.max(base, modelGap) + limiting * 60 + insufficient * 90 + recoverySpreadSec(tsb);
	return {
		fastSec: Math.round(predictedSec - spread * 0.75),
		slowSec: Math.round(predictedSec + spread * 1.25),
	};
}

function unchangedReasonOf({ recentAerobic, basisStatus }) {
	if (recentAerobic) return null;
	if (basisStatus === "historic") {
		return "No recent race-quality effort of 5 km or longer has replaced the historic basis. Easy and long-run splits are used for training support, not as a new race equivalent.";
	}
	return "Easy and long-run splits are used for training support, not as a race equivalent.";
}

/**
 * Combine race-equivalent aerobic potential with training support.
 *
 * The slower available estimate wins: speed alone cannot prove marathon
 * durability, while training pace alone cannot prove the required speed.
 * Older efforts remain visible as historic potential but do not anchor the
 * current finish estimate. Recovery changes the range, not the headline.
 *
 * @param {object} input
 * @returns {object|null}
 */
export function projectMarathon({
	runs = [],
	efforts = null,
	today,
	targetDistanceM = MARATHON_M,
	goalTimeSec = null,
	tsb = null,
} = {}) {
	const allEfforts = qualityEfforts(Array.isArray(efforts) ? efforts : collectBestEfforts(runs));
	const aerobic = predictRace(allEfforts, targetDistanceM);
	const recentEfforts = allEfforts.filter((effort) => {
		const age = daysBetween(effort?.date, today);
		return Number.isFinite(age) && age >= 0 && age <= RECENT_EFFORT_DAYS;
	});
	const recentAerobic = predictRace(recentEfforts, targetDistanceM);
	const training = trainingProjection(runs, today, targetDistanceM);
	const candidates = [recentAerobic?.predictedSec, training?.predictedSec].filter(
		(value) => Number.isFinite(value) && value > 0,
	);
	if (candidates.length === 0 && !aerobic) return null;

	const rawSec = candidates.length > 0 ? Math.max(...candidates) : aerobic.predictedSec;
	const predictedSec = Math.round(rawSec / 60) * 60;
	const basis = recentAerobic?.basis || aerobic?.basis || null;
	const basisAgeDays = basis?.date ? daysBetween(basis.date, today) : null;
	const delta = goalDelta(predictedSec, goalTimeSec);
	const model = recentAerobic || aerobic;
	const basisStatus =
		basis && Number.isFinite(basisAgeDays)
			? basisAgeDays <= RECENT_EFFORT_DAYS
				? "recent"
				: "historic"
			: null;
	const factors = evidenceFactors(runs, training, basisStatus, today);

	return {
		predictedSec,
		trainingSec: training?.predictedSec ?? null,
		training,
		aerobicPotentialSec: aerobic?.predictedSec ?? null,
		recentAerobicPotentialSec: recentAerobic?.predictedSec ?? null,
		riegelSec: model?.riegelSec ?? null,
		vdotSec: model?.vdotSec ?? null,
		vdot: model?.vdot ?? null,
		basis,
		basisAgeDays,
		basisStatus,
		factors,
		confidence: confidenceOf(factors, tsb),
		range: rangeOf(predictedSec, training, recentAerobic, factors, tsb),
		unchangedReason: unchangedReasonOf({ recentAerobic, basisStatus }),
		deltaSec: delta?.deltaSec ?? null,
		onTrack: delta?.onTrack ?? null,
	};
}

/**
 * Seconds a given day's running moved the shared headline.
 *
 * Re-runs the same engine without that day's activities, so a long run that
 * changes volume or durability counts even when it does not beat a 10k PR.
 *
 * @param {object} input
 * @returns {{predictedSec: number, sessionDeltaSec: number}|null}
 */
export function sessionProjectionDelta({
	runs = [],
	efforts = null,
	today,
	date,
	targetDistanceM = MARATHON_M,
	goalTimeSec = null,
	tsb = null,
} = {}) {
	const after = projectMarathon({ runs, efforts, today, targetDistanceM, goalTimeSec, tsb });
	if (!after) return null;
	const priorRuns = (runs || []).filter((activity) => toDayKey(activity?.startDateLocal) !== date);
	const allEfforts = Array.isArray(efforts) ? efforts : collectBestEfforts(runs);
	const priorEfforts = allEfforts.filter((effort) => effort?.date !== date);
	const before = projectMarathon({
		runs: priorRuns,
		efforts: priorEfforts,
		today,
		targetDistanceM,
		goalTimeSec,
		tsb,
	});
	return {
		predictedSec: after.predictedSec,
		sessionDeltaSec: before ? Math.round(after.predictedSec - before.predictedSec) : 0,
	};
}

/**
 * Weekly snapshots of the same headline, for the projection-history chart.
 *
 * @param {object} input
 * @returns {{date: string, predictedSec: number, trainingSec: number|null,
 *   aerobicPotentialSec: number|null}[]}
 */
export function projectionSeries({
	runs = [],
	efforts = null,
	today,
	targetDistanceM = MARATHON_M,
	goalTimeSec = null,
	weeks = 12,
} = {}) {
	const currentMonday = mondayOf(today);
	if (!currentMonday) return [];
	const allEfforts = Array.isArray(efforts) ? efforts : collectBestEfforts(runs);
	const points = [];
	for (let i = weeks - 1; i >= 0; i--) {
		const start = addDays(currentMonday, -i * 7);
		const asOf = i === 0 ? today : addDays(start, 6);
		if (!asOf || asOf > today) continue;
		const sliceRuns = (runs || []).filter((activity) => {
			const day = toDayKey(activity?.startDateLocal);
			return day && day <= asOf;
		});
		const sliceEfforts = allEfforts.filter((effort) => effort?.date && effort.date <= asOf);
		const projection = projectMarathon({
			runs: sliceRuns,
			efforts: sliceEfforts,
			today: asOf,
			targetDistanceM,
			goalTimeSec,
		});
		if (!projection) continue;
		points.push({
			date: asOf,
			predictedSec: projection.predictedSec,
			trainingSec: projection.trainingSec,
			aerobicPotentialSec: projection.aerobicPotentialSec,
		});
	}
	return points;
}
