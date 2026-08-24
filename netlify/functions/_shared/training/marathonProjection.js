// Convert marathon readiness into an adjusted race projection.
//
// Riegel/VDOT remain the aerobic baseline. Readiness only decides how much of
// that baseline the current training can realistically hold for 42.195 km.
// The constants in marathonConfig.js are starting values for later calibration
// against actual race results — they are not a validated physiological model.

import { addDays, toDayKey } from "./dates.js";
import { MARATHON_PROJECTION } from "./marathonConfig.js";
import { scoreMarathonReadiness } from "./marathonReadiness.js";
import { aerobicPotential, goalDelta, goalPaceSecPerKm } from "./predict.js";
import { weekSessions } from "./plan.js";

const CFG = MARATHON_PROJECTION;

export function readinessPenalty(readiness) {
	const r = Math.max(0, Math.min(1, Number(readiness) || 0));
	return 1 + CFG.penalty.k * Math.pow(1 - r, CFG.penalty.exponent);
}

function confidenceOf(parts, potential, runs, today) {
	let score = 0.35;
	const basisM = Number(potential?.basis?.distanceM) || 0;
	if (basisM >= 21097) score += 0.18;
	else if (basisM >= 15000) score += 0.12;
	else if (basisM >= 10000) score += 0.07;
	const longs = parts.longRuns?.metrics || {};
	if (longs.over30 >= 2) score += 0.12;
	else if (longs.over25 >= 2) score += 0.08;
	else if (longs.over20 >= 2) score += 0.04;
	if ((longs.over25 || 0) < 1) score -= 0.12;
	if ((longs.over30 || 0) < 1) score -= 0.05;
	if ((longs.longestM || 0) > 0 && longs.longestM < 26000) score -= 0.08;
	if (parts.decoupling?.available) score += 0.1;
	if ((parts.consistency?.metrics?.zeroWeeks || 0) === 0) score += 0.08;
	if ((parts.volume?.metrics?.ewma8 || 0) >= 60) score += 0.08;
	if (parts.recovery?.available) score += 0.05;
	if ((parts.consistency?.metrics?.zeroWeeks || 0) > 0) score -= 0.1;
	if ((parts.consistency?.metrics?.cv || 0) > 0.4) score -= 0.06;
	if (!parts.decoupling?.available) score -= 0.08;
	if (basisM > 0 && basisM < 10000) score -= 0.08;
	const from = addDays(today, -70);
	const recentLongs = (runs || []).filter((r) => {
		const day = toDayKey(r.startDateLocal);
		return r?.sport !== "ride" && day && day >= from && day <= today && r.distanceM >= 20000;
	}).length;
	if (recentLongs >= 3) score += 0.06;
	return Math.max(0, Math.min(1, score));
}

function confidenceLabel(score) {
	if (score >= CFG.confidence.high) return "High";
	if (score >= CFG.confidence.moderate) return "Moderate";
	return "Low";
}

function projectionRange(predictedSec, aerobicSec, confidence) {
	const spread = predictedSec * (CFG.range.minPct + (CFG.range.maxPct - CFG.range.minPct) * (1 - confidence));
	const fast = Math.max(aerobicSec, predictedSec - spread);
	const slow = predictedSec + spread * CFG.range.slowAsymmetry;
	return { fastSec: fast, slowSec: slow };
}

function kmLabel(metres) {
	if (!(metres > 0)) return null;
	const km = metres / 1000;
	return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

function explanations(parts, potential) {
	const candidates = [];
	const push = (direction, key, strength, text) => {
		if (!text) return;
		candidates.push({ direction, key, strength, text });
	};

	const basis = potential?.basis;
	if (basis?.distanceM) {
		push(
			"positive",
			"baseline",
			0.4 + Math.min(0.4, basis.distanceM / 50000),
			`Strong ${kmLabel(basis.distanceM)}-derived aerobic potential`,
		);
	}

	const volume = parts.volume?.metrics || {};
	if (volume.ewma8 >= 70) {
		push("positive", "volume", 0.35 + (volume.ewma8 - 70) / 80, `Sustained ${Math.round(volume.ewma8)} km weeks`);
	} else if (volume.ewma8 > 0 && volume.ewma8 < 40 && (volume.vsPlan == null || volume.vsPlan < 0.75)) {
		push("limiting", "volume", 0.45 + (40 - volume.ewma8) / 80, `Relatively low sustained 8-week mileage (${Math.round(volume.ewma8)} km/wk)`);
	}

	const longs = parts.longRuns?.metrics || {};
	if (longs.over30 >= 2) {
		push("positive", "longRuns", 0.5, `${longs.over30} recent runs over 30 km`);
	} else if (longs.longestM >= 25000 && longs.over25 >= 2) {
		push("positive", "longRuns", 0.4, `Recent long runs averaging ${kmLabel(longs.averageM)}`);
	}
	if (longs.longestM > 0 && longs.longestM < 26000) {
		push("limiting", "longRuns", 0.55, `Longest recent run only ${kmLabel(longs.longestM)}`);
	}
	if (Number.isFinite(longs.sharePct) && longs.sharePct >= CFG.longRunShare.cautionPct) {
		push("limiting", "longRunShare", 0.3, `High long-run share of weekly mileage (${Math.round(longs.sharePct)}%)`);
	}

	const dec = parts.decoupling?.metrics || {};
	if (parts.decoupling?.available && dec.meanPct <= 3) {
		push("positive", "decoupling", 0.45, `Low long-run aerobic decoupling (${dec.meanPct.toFixed(1)}%)`);
	} else if (parts.decoupling?.available && dec.meanPct >= 6) {
		push("limiting", "decoupling", 0.5, `Long-run aerobic decoupling still elevated (${dec.meanPct.toFixed(1)}%)`);
	}

	const freq = parts.frequency?.metrics || {};
	if (freq.perWeek >= 4.3) {
		push("positive", "frequency", 0.25, `About ${freq.perWeek.toFixed(1)} runs/week`);
	} else if (freq.perWeek > 0 && freq.perWeek < 3.4) {
		push("limiting", "frequency", 0.35, `Only ~${freq.perWeek.toFixed(1)} runs/week`);
	}

	const fit = parts.fitnessTrend?.metrics || {};
	if (Number.isFinite(fit.gain28) && fit.gain28 >= 2) {
		push("positive", "fitnessTrend", 0.3, "Fitness trending upward");
	} else if (Number.isFinite(fit.gain28) && fit.gain28 <= -4) {
		push("limiting", "fitnessTrend", 0.28, "Fitness trending down over four weeks");
	}

	const cons = parts.consistency?.metrics || {};
	if ((cons.zeroWeeks || 0) > 0) {
		push("limiting", "consistency", 0.5, "Recent interruption in training");
	} else if (Number.isFinite(cons.plannedPct) && cons.plannedPct >= 90) {
		push("positive", "consistency", 0.25, "Training volume tracking close to plan");
	}

	const rec = parts.recovery;
	if (rec?.available) {
		const hrv = rec.metrics?.hrv;
		const rhr = rec.metrics?.rhr;
		const sleep = rec.metrics?.sleep;
		const goodHrv = Number.isFinite(hrv?.deltaPct) && hrv.deltaPct >= -5;
		const goodRhr = Number.isFinite(rhr?.delta) && rhr.delta <= 2;
		const goodSleep = Number.isFinite(sleep?.deltaPct) ? sleep.deltaPct >= -8 : true;
		if (goodHrv && goodRhr && goodSleep) {
			push("positive", "recovery", 0.22, "Recovery near/above baseline");
		} else if ((Number.isFinite(hrv?.deltaPct) && hrv.deltaPct <= -CFG.recovery.hrvDropPct) ||
			(Number.isFinite(rhr?.delta) && rhr.delta >= CFG.recovery.rhrRiseBpm)) {
			push("limiting", "recovery", 0.32, "Recovery markers below personal baseline");
		}
	}

	candidates.sort((a, b) => b.strength - a.strength);
	const picked = [];
	const seen = new Set();
	for (const item of candidates) {
		if (seen.has(item.key)) continue;
		picked.push(item);
		seen.add(item.key);
		if (picked.length >= 4) break;
	}
	return picked;
}

function plannedFutureRuns(plan, today) {
	const synthetic = [];
	for (const week of plan?.weeks || []) {
		for (const session of weekSessions(week)) {
			if (!session.isRun || !session.date || session.date <= today) continue;
			const km = Number(session.distanceKm) || 0;
			if (!(km > 0)) continue;
			synthetic.push({
				sport: "run",
				startDateLocal: `${session.date}T07:00:00`,
				distanceM: km * 1000 * CFG.raceDay.plannedCredit,
				movingTimeSec: km * 360 * CFG.raceDay.plannedCredit,
				paceSecPerKm: 340,
				gapPaceSecPerKm: 340,
				decouplingPct: session.type === "long run" || session.type === "race" ? 4 : null,
				load: 40 * CFG.raceDay.plannedCredit,
				bestEfforts: [],
			});
		}
	}
	return synthetic;
}

function assemble({ potential, readiness, runs, today, race }) {
	const penalty = readinessPenalty(readiness.marathonReadiness);
	const predictedSec = potential.predictedSec * penalty;
	const confidence = confidenceOf(readiness.parts, potential, runs, today);
	const delta = goalDelta(predictedSec, race?.goalTimeSec);
	return {
		predictedSec,
		aerobicPotentialSeconds: potential.predictedSec,
		riegelSec: potential.riegelSec,
		vdotSec: potential.vdotSec,
		vdot: potential.vdot,
		basis: potential.basis,
		marathonReadiness: readiness.marathonReadiness,
		readinessPenalty: penalty,
		confidence,
		confidenceLabel: confidenceLabel(confidence),
		projectionRange: projectionRange(predictedSec, potential.predictedSec, confidence),
		factors: readiness.factors,
		explanations: explanations(readiness.parts, potential),
		deltaSec: delta?.deltaSec ?? null,
		onTrack: delta?.onTrack ?? null,
		goalPaceSecPerKm: goalPaceSecPerKm(race?.goalTimeSec, race?.distanceM || 42195),
	};
}

/**
 * Full marathon projection from aerobic potential plus current readiness.
 *
 * @param {object} input
 * @returns {object|null}
 */
export function projectMarathon(input) {
	const {
		efforts = [],
		runs = [],
		weeks = [],
		series = [],
		acwr = null,
		intensity = null,
		recovery = null,
		today,
		race = {},
		plan = null,
		daysToRace = null,
	} = input;
	const targetDistanceM = race.distanceM || 42195;
	const runActivities = (runs || []).filter((activity) => activity?.sport !== "ride");
	const potential = aerobicPotential(efforts, targetDistanceM, today);
	if (!potential) return null;

	const predictedPace = potential.predictedSec / (targetDistanceM / 1000);
	const readinessInput = {
		runs: runActivities,
		weeks,
		series,
		acwr,
		intensity,
		recovery,
		today,
		daysToRace,
		predictedPaceSecPerKm: predictedPace,
	};
	const todayReady = scoreMarathonReadiness(readinessInput);
	const current = assemble({ potential, readiness: todayReady, runs: runActivities, today, race });

	let raceDay = null;
	const remainingKm = (plan?.weeks || []).reduce((sum, week) => {
		const sessions = weekSessions(week);
		return (
			sum +
			sessions
				.filter((s) => s.isRun && s.date > today)
				.reduce((n, s) => n + (Number(s.distanceKm) || 0), 0)
		);
	}, 0);
	if (
		plan &&
		Number.isFinite(daysToRace) &&
		daysToRace >= CFG.raceDay.minDaysToRace &&
		remainingKm >= CFG.raceDay.minRemainingKm
	) {
		const future = plannedFutureRuns(plan, today);
		const raceReady = scoreMarathonReadiness({
			...readinessInput,
			runs: [...runActivities, ...future],
		});
		if (raceReady.marathonReadiness > todayReady.marathonReadiness) {
			raceDay = {
				marathonReadiness: raceReady.marathonReadiness,
				predictedSec: potential.predictedSec * readinessPenalty(raceReady.marathonReadiness),
				factors: raceReady.factors,
			};
		}
	}

	return {
		...current,
		raceDay,
		debug: {
			aerobicPotentialSeconds: current.aerobicPotentialSeconds,
			marathonReadiness: current.marathonReadiness,
			readinessPenalty: current.readinessPenalty,
			adjustedProjectionSeconds: current.predictedSec,
			confidence: current.confidence,
			projectionRange: current.projectionRange,
			factors: current.factors,
		},
	};
}
