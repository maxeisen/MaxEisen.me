// Marathon-specific readiness scores.
//
// Each function here returns a 0–1 score plus the metrics that produced it.
// The composite is a weighted mean of those scores; missing evidence (no HR
// on long runs, no ring) drops out of the mean rather than being invented as
// a zero. Training data can only close the gap to aerobic potential — it
// does not mint a faster marathon than Riegel/VDOT already implied.

import { addDays, daysBetween, mondayOf, toDayKey } from "./dates.js";
import { fitnessGain } from "./fitness.js";
import { MARATHON_PROJECTION } from "./marathonConfig.js";

const CFG = MARATHON_PROJECTION;

export function clamp01(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.min(1, n));
}

/**
 * Linear 0–1 score between a floor and a full mark, clamped.
 *
 * @param {number} value
 * @param {number} floor
 * @param {number} full
 * @returns {number}
 */
export function lerpScore(value, floor, full) {
	const v = Number(value);
	const lo = Number(floor);
	const hi = Number(full);
	if (!Number.isFinite(v) || !Number.isFinite(lo) || !Number.isFinite(hi)) return 0;
	if (hi <= lo) return v >= hi ? 1 : 0;
	return clamp01((v - lo) / (hi - lo));
}

function smoothstep(edge0, edge1, x) {
	const t = clamp01((Number(x) - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}

export function recencyWeight(date, today, halfLifeDays) {
	const age = daysBetween(toDayKey(date), toDayKey(today));
	if (!Number.isFinite(age)) return 0;
	if (age < 0) return 1;
	return Math.pow(0.5, age / halfLifeDays);
}

function isRun(activity) {
	return activity?.sport !== "ride";
}

function completeWeeks(weeks, today) {
	const current = mondayOf(today);
	return (weeks || []).filter((week) => week?.start && current && week.start < current);
}

function volumeWindow(weeks, today) {
	const complete = completeWeeks(weeks, today);
	const withoutTaper = complete.filter((week) => week.isTaper !== true);
	const pick = withoutTaper.length >= 3 ? withoutTaper : complete;
	return pick.slice(-Math.max(CFG.windows.volumeSlowWeeks, CFG.windows.peakWeeks));
}

function weeklyKm(week) {
	return (Number(week?.distanceM) || 0) / 1000;
}

function ewmaWeekly(weeks, span) {
	const slice = weeks.slice(-span);
	if (slice.length === 0) return 0;
	const alpha = 2 / (span + 1);
	let value = weeklyKm(slice[0]);
	for (let i = 1; i < slice.length; i++) {
		value = alpha * weeklyKm(slice[i]) + (1 - alpha) * value;
	}
	return value;
}

function meanTop(weeks, count) {
	const kms = weeks.map(weeklyKm).sort((a, b) => b - a);
	const top = kms.slice(0, count);
	if (top.length === 0) return 0;
	return top.reduce((sum, n) => sum + n, 0) / top.length;
}

/**
 * @param {{weeks: object[], today: string}} input
 * @returns {{score: number, metrics: object}}
 */
export function scoreVolume({ weeks, today }) {
	const window = volumeWindow(weeks, today);
	const ewma8 = ewmaWeekly(window, CFG.windows.volumeSlowWeeks);
	const ewma4 = ewmaWeekly(window, CFG.windows.volumeFastWeeks);
	const peak = meanTop(window, CFG.windows.peakCount);
	const score = clamp01(
		0.5 * lerpScore(ewma8, CFG.volume.ewma8FloorKm, CFG.volume.ewma8FullKm) +
			0.3 * lerpScore(ewma4, CFG.volume.ewma4FloorKm, CFG.volume.ewma4FullKm) +
			0.2 * lerpScore(peak, CFG.volume.peakFloorKm, CFG.volume.peakFullKm),
	);
	return { score, metrics: { ewma8, ewma4, peak } };
}

function longRunCandidates(runs, today) {
	const from = addDays(today, -(CFG.windows.longRunDays - 1));
	return (runs || []).filter((activity) => {
		if (!isRun(activity)) return false;
		const day = toDayKey(activity.startDateLocal);
		if (!day || (from && day < from) || day > today) return false;
		return (Number(activity.distanceM) || 0) >= CFG.longRuns.countMinM;
	});
}

function longRunSharePenalty(weeks, today) {
	const recent = completeWeeks(weeks, today)
		.filter((week) => week.isTaper !== true)
		.slice(-6)
		.map((week) => {
			const total = Number(week.distanceM) || 0;
			if (!(total > 0)) return null;
			return ((Number(week.longestRunM) || 0) / total) * 100;
		})
		.filter((n) => Number.isFinite(n));
	if (recent.length < 3) return { penalty: 0, sharePct: null };
	const sharePct = recent.reduce((sum, n) => sum + n, 0) / recent.length;
	const penalty =
		CFG.longRunShare.maxPenalty *
		smoothstep(CFG.longRunShare.cautionPct, CFG.longRunShare.heavyPct, sharePct);
	return { penalty, sharePct };
}

function paceModifier(runs, predictedPaceSecPerKm) {
	if (!(predictedPaceSecPerKm > 0)) return 1;
	const near = CFG.longRuns;
	let credit = 0;
	let considered = 0;
	for (const activity of runs) {
		if ((Number(activity.distanceM) || 0) < near.over20M) continue;
		const pace = Number(activity.gapPaceSecPerKm) || Number(activity.paceSecPerKm);
		if (!(pace > 0)) continue;
		considered += 1;
		const ratio = pace / predictedPaceSecPerKm;
		const inBand = ratio >= near.nearMarathonPaceFloor && ratio <= near.nearMarathonPaceCeil;
		const stable = !Number.isFinite(activity.decouplingPct) || activity.decouplingPct <= 5;
		if (inBand && stable) credit += 1;
	}
	if (considered === 0) return 1;
	return 1 + near.paceBoost * (credit / considered);
}

/**
 * @param {{runs: object[], today: string, predictedPaceSecPerKm?: number, weeks?: object[]}} input
 * @returns {{score: number, metrics: object}}
 */
export function scoreLongRuns({ runs, today, predictedPaceSecPerKm, weeks = [] }) {
	const candidates = longRunCandidates(runs, today);
	const longestM = candidates.reduce((max, a) => Math.max(max, Number(a.distanceM) || 0), 0);
	const ranked = [...candidates].sort((a, b) => (Number(b.distanceM) || 0) - (Number(a.distanceM) || 0));
	const top = ranked.slice(0, CFG.longRuns.topN);
	let weightSum = 0;
	let distanceSum = 0;
	for (const activity of top) {
		const weight = recencyWeight(activity.startDateLocal, today, CFG.windows.recencyHalfLifeDays);
		weightSum += weight;
		distanceSum += (Number(activity.distanceM) || 0) * weight;
	}
	const averageM = weightSum > 0 ? distanceSum / weightSum : 0;
	const over20 = candidates.filter((a) => a.distanceM >= CFG.longRuns.over20M).length;
	const over25 = candidates.filter((a) => a.distanceM >= CFG.longRuns.over25M).length;
	const over30 = candidates.filter((a) => a.distanceM >= CFG.longRuns.over30M).length;

	const dated = [...candidates].sort((a, b) =>
		String(a.startDateLocal).localeCompare(String(b.startDateLocal)),
	);
	let progression = 0.5;
	if (dated.length >= 3) {
		const first = dated.slice(0, Math.ceil(dated.length / 2));
		const last = dated.slice(-Math.ceil(dated.length / 2));
		const mean = (list) => list.reduce((sum, a) => sum + a.distanceM, 0) / list.length;
		progression = lerpScore(mean(last) - mean(first), -4000, 6000);
	}

	const raw =
		0.28 * lerpScore(longestM, CFG.longRuns.longestFloorM, CFG.longRuns.longestFullM) +
		0.34 * lerpScore(averageM, CFG.longRuns.averageFloorM, CFG.longRuns.averageFullM) +
		0.12 * lerpScore(over20, 1, CFG.longRuns.countsFull.over20) +
		0.12 * lerpScore(over25, 0, CFG.longRuns.countsFull.over25) +
		0.08 * lerpScore(over30, 0, CFG.longRuns.countsFull.over30) +
		0.06 * progression;

	const { penalty, sharePct } = longRunSharePenalty(weeks, today);
	const score = clamp01(raw * paceModifier(top, predictedPaceSecPerKm) * (1 - penalty));
	return {
		score,
		metrics: { longestM, averageM, over20, over25, over30, sharePct, progression },
	};
}

/**
 * @param {{runs: object[], today: string}} input
 * @returns {{score: number, metrics: object, available: boolean}}
 */
export function scoreDecoupling({ runs, today }) {
	const from = addDays(today, -(CFG.windows.longRunDays - 1));
	const samples = [];
	for (const activity of runs || []) {
		if (!isRun(activity)) continue;
		const day = toDayKey(activity.startDateLocal);
		if (!day || (from && day < from) || day > today) continue;
		if (!((Number(activity.movingTimeSec) || 0) >= CFG.decoupling.minDurationSec)) continue;
		if (!Number.isFinite(activity.decouplingPct)) continue;
		const duration = Number(activity.movingTimeSec);
		const clamped = Math.max(0, Number(activity.decouplingPct));
		const weight = duration * recencyWeight(day, today, CFG.windows.recencyHalfLifeDays);
		samples.push({ decouplingPct: clamped, weight, duration });
	}
	if (samples.length === 0) {
		return { score: 0, metrics: { meanPct: null, runs: 0 }, available: false };
	}
	const weightSum = samples.reduce((sum, s) => sum + s.weight, 0);
	const meanPct = samples.reduce((sum, s) => sum + s.decouplingPct * s.weight, 0) / weightSum;
	const score = 1 - smoothstep(CFG.decoupling.excellentPct, CFG.decoupling.concernPct, meanPct);
	return { score: clamp01(score), metrics: { meanPct, runs: samples.length }, available: true };
}

/**
 * @param {{weeks: object[], today: string}} input
 * @returns {{score: number, metrics: object}}
 */
export function scoreConsistency({ weeks, today }) {
	const complete = completeWeeks(weeks, today)
		.filter((week) => week.isTaper !== true)
		.slice(-CFG.windows.consistencyWeeks);
	const startAt = complete.findIndex((week) => week.runs > 0 || weeklyKm(week) >= 1);
	const window = startAt >= 0 ? complete.slice(startAt) : [];
	if (window.length === 0) return { score: 0.4, metrics: { plannedPct: null, zeroWeeks: 0, cv: null } };

	const planned = window.filter((week) => Number.isFinite(week.volumePct) && week.isPlanned);
	const plannedPct =
		planned.length > 0
			? planned.reduce((sum, week) => sum + Math.min(120, week.volumePct), 0) / planned.length
			: null;
	const kms = window.map(weeklyKm);
	const mean = kms.reduce((sum, n) => sum + n, 0) / kms.length;
	const variance = kms.reduce((sum, n) => sum + (n - mean) ** 2, 0) / kms.length;
	const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
	const zeroWeeks = window.filter((week) => week.runs === 0 || weeklyKm(week) < 1).length;
	const lowWeeks = window.filter((week) => {
		if (week.isTaper) return false;
		if (Number.isFinite(week.volumePct)) return week.volumePct < CFG.consistency.lowVolumePct;
		return mean > 0 && weeklyKm(week) < mean * (CFG.consistency.lowVolumePct / 100);
	}).length;

	const plannedScore = plannedPct === null ? 0.7 : lerpScore(plannedPct, 40, 95);
	const cvScore = 1 - lerpScore(cv, CFG.consistency.cvFull, CFG.consistency.cvFloor);
	const zeroPenalty = clamp01(zeroWeeks * 0.22);
	const lowPenalty = clamp01(lowWeeks * 0.08);
	const score = clamp01(0.55 * plannedScore + 0.45 * cvScore - zeroPenalty - lowPenalty);
	return { score, metrics: { plannedPct, zeroWeeks, lowWeeks, cv } };
}

/**
 * @param {{runs: object[], today: string}} input
 * @returns {{score: number, metrics: object}}
 */
export function scoreFrequency({ runs, today }) {
	const from = addDays(today, -(CFG.windows.frequencyDays - 1));
	const count = (runs || []).filter((activity) => {
		if (!isRun(activity)) return false;
		const day = toDayKey(activity.startDateLocal);
		return day && (!from || day >= from) && day <= today;
	}).length;
	const perWeek = count / (CFG.windows.frequencyDays / 7);
	return {
		score: lerpScore(perWeek, CFG.frequency.floor, CFG.frequency.full),
		metrics: { perWeek, count },
	};
}

/**
 * @param {{series: object[], today: string, daysToRace?: number, acwr?: object}} input
 * @returns {{score: number, metrics: object}}
 */
export function scoreFitnessTrend({ series, today, daysToRace, acwr }) {
	const gain28 = fitnessGain(series, today, 28);
	const gain42 = fitnessGain(series, today, 42);
	const gain = Number.isFinite(gain28) ? gain28 : Number.isFinite(gain42) ? gain42 : 0;
	const trend = lerpScore(gain, CFG.fitness.gainFloor, CFG.fitness.gainFull);
	const ratio = Number(acwr?.ratio);
	const acwrScore = Number.isFinite(ratio)
		? 1 - clamp01(Math.abs(ratio - CFG.fitness.acwrIdeal) / CFG.fitness.acwrSpread)
		: 0.7;
	const latest = (series || []).find((d) => d.date === today) || (series || []).at(-1);
	const inTaper = Number.isFinite(daysToRace) && daysToRace <= CFG.fitness.taperDays;
	// Negative form is expected in a build. Near race day, positive form can
	// raise the score slightly; it never lowers it.
	let formScore = 0.7;
	if (inTaper && Number.isFinite(latest?.tsb) && latest.tsb > 0) {
		formScore = 0.7 + 0.3 * lerpScore(latest.tsb, 0, 15);
	}
	const score = clamp01(0.55 * trend + 0.3 * acwrScore + 0.15 * formScore);
	return { score, metrics: { gain28, gain42, ratio, tsb: latest?.tsb ?? null, inTaper } };
}

function recoveryTrend(recovery, field, today) {
	const series = recovery?.series || [];
	if (series.length === 0) return recovery?.[field] || null;
	const recentFrom = addDays(today, -6);
	const baseFrom = addDays(today, -(CFG.windows.recoveryBaselineDays - 1));
	const mean = (from) => {
		const values = series
			.filter((row) => row.day >= from && row.day <= today)
			.map((row) => Number(row[field === "hrv" ? "averageHrv" : field === "restingHr" ? "restingHr" : "sleepSec"]))
			.filter((n) => Number.isFinite(n));
		if (values.length < 3) return null;
		return values.reduce((sum, n) => sum + n, 0) / values.length;
	};
	const recent = mean(recentFrom);
	const baseline = mean(baseFrom);
	if (recent === null || baseline === null) return recovery?.[field] || null;
	return {
		recent,
		baseline,
		delta: recent - baseline,
		deltaPct: baseline > 0 ? ((recent - baseline) / baseline) * 100 : null,
	};
}

/**
 * @param {{recovery: object|null, today: string}} input
 * @returns {{score: number, metrics: object, available: boolean}}
 */
export function scoreRecovery({ recovery, today }) {
	if (!recovery) return { score: 0, metrics: {}, available: false };
	const sleep = recoveryTrend(recovery, "sleep", today) || recovery.sleep;
	const rhr = recoveryTrend(recovery, "restingHr", today) || recovery.restingHr;
	const hrv = recoveryTrend(recovery, "hrv", today) || recovery.hrv;
	const pieces = [];
	if (Number.isFinite(hrv?.deltaPct)) {
		pieces.push(1 - lerpScore(-hrv.deltaPct, 0, CFG.recovery.hrvDropPct));
	}
	if (Number.isFinite(rhr?.delta)) {
		pieces.push(1 - lerpScore(rhr.delta, 0, CFG.recovery.rhrRiseBpm));
	}
	if (Number.isFinite(sleep?.deltaPct)) {
		pieces.push(1 - lerpScore(-sleep.deltaPct, 0, CFG.recovery.sleepDropPct));
	} else if (Number.isFinite(sleep?.recent) && Number.isFinite(sleep?.baseline) && sleep.baseline > 0) {
		pieces.push(1 - lerpScore((sleep.baseline - sleep.recent) / sleep.baseline * 100, 0, CFG.recovery.sleepDropPct));
	}
	if (pieces.length === 0) return { score: 0, metrics: { sleep, rhr, hrv }, available: false };
	const score = clamp01(pieces.reduce((sum, n) => sum + n, 0) / pieces.length);
	return { score, metrics: { sleep, rhr, hrv }, available: true };
}

function intensityPenalty(intensity, acwr) {
	const easy = Number(intensity?.easyPct);
	const ratio = Number(acwr?.ratio);
	if (!Number.isFinite(easy) || easy >= CFG.intensity.easyFloorPct) return 0;
	if (!Number.isFinite(ratio) || ratio < CFG.intensity.acwrSpike) return 0;
	return CFG.intensity.maxPenalty * smoothstep(CFG.intensity.easyFloorPct, 50, 100 - easy);
}

/**
 * Weighted mean of factor scores. Unavailable factors drop out so missing
 * heart-rate data cannot masquerade as terrible decoupling.
 *
 * @param {object} factors
 * @returns {{marathonReadiness: number, factors: object}}
 */
export function combineReadiness(factors, { intensity, acwr } = {}) {
	const keys = Object.keys(CFG.weights);
	let weightSum = 0;
	let total = 0;
	const scores = {};
	for (const key of keys) {
		const part = factors[key];
		const score = clamp01(part?.score);
		scores[key] = score;
		if (part?.available === false) continue;
		const weight = CFG.weights[key];
		weightSum += weight;
		total += weight * score;
	}
	const combined = weightSum > 0 ? total / weightSum : 0;
	const ready = clamp01(combined * (1 - intensityPenalty(intensity, acwr)));
	return { marathonReadiness: ready, factors: scores };
}

/**
 * Score current marathon readiness from completed training only.
 *
 * @param {object} input
 * @returns {{marathonReadiness: number, factors: object, parts: object}}
 */
export function scoreMarathonReadiness(input) {
	const parts = {
		volume: scoreVolume(input),
		longRuns: scoreLongRuns(input),
		decoupling: scoreDecoupling(input),
		consistency: scoreConsistency(input),
		frequency: scoreFrequency(input),
		fitnessTrend: scoreFitnessTrend(input),
		recovery: scoreRecovery(input),
	};
	const combined = combineReadiness(parts, input);
	return { ...combined, parts };
}
