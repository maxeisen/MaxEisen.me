// Race-time prediction.
//
// Two independent models, deliberately kept separate rather than blended into
// one number, because they fail in different ways and the disagreement between
// them is itself informative.
//
// Riegel: t₂ = t₁ · (d₂/d₁)^1.06. A pure curve fit across race distances. The
// 1.06 exponent was derived from field results and holds up well from 1500m to
// the half, but it assumes the endurance to hold the extrapolated pace, so
// projecting a 10k straight to a marathon flatters anyone who hasn't done the
// long-run work.
//
// Daniels-Gilbert VDOT: estimates the oxygen cost of a performance and the
// fraction of maximum you can sustain for a given duration, then inverts that
// to predict another distance. Same caveat — it describes an appropriately
// trained runner.
//
// Both therefore skew optimistic for the marathon specifically, so the headline
// prediction takes the SLOWER of the two. Better to under-promise on a race
// you get one shot at.

/**
 * Riegel endurance-curve projection.
 *
 * @param {number} timeSec time for the known performance.
 * @param {number} distanceM distance of the known performance.
 * @param {number} targetDistanceM
 * @param {number} [exponent]
 * @returns {number|null} predicted seconds.
 */
export function riegel(timeSec, distanceM, targetDistanceM, exponent = 1.06) {
	const t = Number(timeSec);
	const d = Number(distanceM);
	const target = Number(targetDistanceM);
	if (!(t > 0) || !(d > 0) || !(target > 0)) return null;
	return t * Math.pow(target / d, exponent);
}

/**
 * Oxygen cost of running at a velocity, in ml/kg/min.
 *
 * @param {number} velocityMPerMin
 * @returns {number}
 */
export function oxygenCost(velocityMPerMin) {
	const v = Number(velocityMPerMin) || 0;
	return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

/**
 * Fraction of VO2max sustainable for a given duration.
 *
 * @param {number} minutes
 * @returns {number}
 */
export function sustainableFraction(minutes) {
	const t = Number(minutes) || 0;
	return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
}

/**
 * VDOT implied by a performance.
 *
 * @param {number} distanceM
 * @param {number} timeSec
 * @returns {number|null}
 */
export function vdot(distanceM, timeSec) {
	const d = Number(distanceM);
	const t = Number(timeSec);
	if (!(d > 0) || !(t > 0)) return null;
	const minutes = t / 60;
	const value = oxygenCost(d / minutes) / sustainableFraction(minutes);
	return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Invert VDOT to a predicted time. Both sides of the equation depend on
 * duration, so this bisects on time rather than solving in closed form.
 *
 * @param {number} vdotValue
 * @param {number} distanceM
 * @returns {number|null} predicted seconds.
 */
export function timeForVdot(vdotValue, distanceM) {
	const target = Number(vdotValue);
	const d = Number(distanceM);
	if (!(target > 0) || !(d > 0)) return null;

	// Bracket generously: three minutes to twelve hours covers anything a
	// human will ever ask this for.
	let low = 180;
	let high = 43_200;
	for (let i = 0; i < 60; i++) {
		const mid = (low + high) / 2;
		const implied = vdot(d, mid);
		if (implied === null) return null;
		// Longer time means a lower implied VDOT, so the comparison inverts.
		if (implied > target) low = mid;
		else high = mid;
	}
	return (low + high) / 2;
}

/**
 * Project a known performance onto another distance using VDOT.
 *
 * @param {number} timeSec
 * @param {number} distanceM
 * @param {number} targetDistanceM
 * @returns {number|null}
 */
export function vdotProjection(timeSec, distanceM, targetDistanceM) {
	const value = vdot(distanceM, timeSec);
	return value === null ? null : timeForVdot(value, targetDistanceM);
}

/**
 * Headline prediction from a single performance: both models, plus the
 * conservative pick.
 *
 * @param {{timeSec: number, distanceM: number}} effort
 * @param {number} targetDistanceM
 * @returns {{predictedSec: number, riegelSec: number|null, vdotSec: number|null,
 *   vdot: number|null} | null}
 */
export function predictFromEffort(effort, targetDistanceM) {
	const riegelSec = riegel(effort?.timeSec, effort?.distanceM, targetDistanceM);
	const vdotSec = vdotProjection(effort?.timeSec, effort?.distanceM, targetDistanceM);
	const candidates = [riegelSec, vdotSec].filter((n) => Number.isFinite(n) && n > 0);
	if (candidates.length === 0) return null;
	return {
		predictedSec: Math.max(...candidates),
		riegelSec,
		vdotSec,
		vdot: vdot(effort?.distanceM, effort?.timeSec),
	};
}

// Efforts shorter than this extrapolate too far to say much about a marathon.
const MIN_BASIS_DISTANCE_M = 5000;

/**
 * Pick the best basis effort and predict from it.
 *
 * Prefers the effort with the highest implied VDOT — the runner's genuine best
 * shape — rather than simply the most recent or longest, but only considers
 * efforts of 5k and up, since projecting a marathon off a fast 800m says more
 * about leg speed than endurance.
 *
 * @param {{timeSec: number, distanceM: number, name?: string, date?: string}[]} efforts
 * @param {number} targetDistanceM
 * @returns {object|null} the prediction plus the effort it came from.
 */
export function predictRace(efforts, targetDistanceM) {
	let best = null;
	for (const effort of efforts || []) {
		if (!(Number(effort?.distanceM) >= MIN_BASIS_DISTANCE_M)) continue;
		const value = vdot(effort.distanceM, effort.timeSec);
		if (value === null) continue;
		if (!best || value > best.vdot) best = { effort, vdot: value };
	}
	if (!best) return null;

	const prediction = predictFromEffort(best.effort, targetDistanceM);
	return prediction ? { ...prediction, basis: best.effort } : null;
}

/**
 * Gap between a prediction and the goal.
 *
 * @param {number} predictedSec
 * @param {number} goalSec
 * @returns {{deltaSec: number, onTrack: boolean}|null} positive delta means
 *   predicted to finish slower than the goal.
 */
export function goalDelta(predictedSec, goalSec) {
	const predicted = Number(predictedSec);
	const goal = Number(goalSec);
	if (!(predicted > 0) || !(goal > 0)) return null;
	return { deltaSec: predicted - goal, onTrack: predicted <= goal };
}

/**
 * Even-effort pace required to hit a goal time.
 *
 * @param {number} goalSec
 * @param {number} distanceM
 * @returns {number|null} seconds per kilometre.
 */
export function goalPaceSecPerKm(goalSec, distanceM) {
	const goal = Number(goalSec);
	const d = Number(distanceM);
	if (!(goal > 0) || !(d > 0)) return null;
	return goal / (d / 1000);
}
