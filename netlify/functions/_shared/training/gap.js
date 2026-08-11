// Grade-adjusted pace (GAP).
//
// Running up a hill at 6:00/km is a harder effort than running 6:00/km on the
// flat, so raw pace can't be compared across routes. GAP converts an effort to
// the pace it would have been on flat ground, which is what makes "was this
// week's easy running actually easy?" answerable on a hilly course.
//
// The conversion uses the Minetti et al. (2002) measurements of the metabolic
// cost of running on a gradient. Cost is a fifth-order polynomial in gradient
// `i` (a fraction, so 0.05 is a 5% climb), in joules per kilogram per metre:
//
//   Cr(i) = 155.4i⁵ − 30.4i⁴ − 43.3i³ + 46.3i² + 19.5i + 3.6
//
// Note that this is NOT monotonic: cost falls to a minimum around −20% and
// climbs again on steeper descents, because braking on a steep downhill costs
// real energy. A naive "downhill is always easier" adjustment gets that wrong.
//
// Deliberately no GPS anywhere in this module. Gradient comes from Strava's
// `grade_smooth` stream or from per-kilometre `elevation_difference`, both of
// which are available without ever requesting latlng — which is what lets the
// public /training payload carry full GAP but no coordinates.

// Cost on the flat, i.e. Cr(0). Every factor is expressed relative to this.
export const FLAT_COST = 3.6;

// Minetti's treadmill protocol covered ±45%. Beyond that the polynomial
// diverges fast (it's a fit, not a law), so clamp rather than extrapolate.
export const GRADE_CLAMP = 0.45;

// Plausible speeds for a single sample, in m/s. Strava's `time` stream is
// elapsed, not moving, so a stop where the GPS drifts a couple of metres shows
// up as a sample covering minutes — left in, one traffic light can double a
// run's grade-adjusted pace. The upper bound catches the opposite artefact,
// where a signal re-acquisition teleports the trace forward.
//
// 0.5 m/s is far slower than walking, and 8 m/s is faster than this athlete
// will ever sustain, so neither bound can discard real running.
const MIN_SEGMENT_SPEED = 0.5;
const MAX_SEGMENT_SPEED = 8;

/**
 * Metabolic cost of running at a gradient, in J/kg/m.
 *
 * @param {number} gradient rise over run as a fraction (0.05 = 5% uphill).
 * @returns {number}
 */
export function costOfRunning(gradient) {
	const i = Math.max(-GRADE_CLAMP, Math.min(GRADE_CLAMP, gradient || 0));
	const i2 = i * i;
	const i3 = i2 * i;
	const i4 = i3 * i;
	const i5 = i4 * i;
	return 155.4 * i5 - 30.4 * i4 - 43.3 * i3 + 46.3 * i2 + 19.5 * i + 3.6;
}

/**
 * How much harder a gradient is than the flat. 1.0 on the flat, ~1.66 at 10%
 * up, ~0.6 at 10% down.
 *
 * @param {number} gradient
 * @returns {number}
 */
export function gradeFactor(gradient) {
	return costOfRunning(gradient) / FLAT_COST;
}

/**
 * Convert an actual speed at a gradient to the flat speed of equal effort.
 *
 * @param {number} speedMps
 * @param {number} gradient
 * @returns {number} equivalent flat speed in m/s.
 */
export function gradeAdjustedSpeed(speedMps, gradient) {
	return speedMps * gradeFactor(gradient);
}

/**
 * Collapse timed, graded segments into one grade-adjusted pace.
 *
 * Covering a segment on the flat at equal effort would take
 * `timeSec / gradeFactor`, so summing that across segments gives the flat time
 * the whole run is worth, and dividing distance by it gives GAP.
 *
 * `adjustment` is that flat time as a fraction of the real time: 0.95 means the
 * terrain cost 5%. It's the part worth carrying forward, because it depends
 * only on the shape of the route and not on how completely the segments cover
 * the run — see activityGap.
 *
 * @param {{distanceM: number, timeSec: number, gradient: number}[]} segments
 * @returns {{gapPaceSecPerKm: number, paceSecPerKm: number, distanceM: number,
 *   flatTimeSec: number, timeSec: number, adjustment: number} | null} null when
 *   there's nothing usable to measure.
 */
export function gapFromSegments(segments) {
	let distanceM = 0;
	let timeSec = 0;
	let flatTimeSec = 0;

	for (const seg of segments || []) {
		const d = Number(seg?.distanceM);
		const t = Number(seg?.timeSec);
		// Zero-time or zero-distance segments (GPS pauses, stopped clock) carry
		// no pace information and would divide by zero downstream.
		if (!Number.isFinite(d) || !Number.isFinite(t) || d <= 0 || t <= 0) continue;
		// Standing still and GPS jumps aren't running, and both distort the
		// grade adjustment badly enough to be worth dropping outright.
		const speed = d / t;
		if (speed < MIN_SEGMENT_SPEED || speed > MAX_SEGMENT_SPEED) continue;
		distanceM += d;
		timeSec += t;
		flatTimeSec += t / gradeFactor(Number(seg.gradient) || 0);
	}

	if (distanceM <= 0 || flatTimeSec <= 0 || timeSec <= 0) return null;
	const km = distanceM / 1000;
	return {
		gapPaceSecPerKm: flatTimeSec / km,
		paceSecPerKm: timeSec / km,
		distanceM,
		flatTimeSec,
		timeSec,
		adjustment: flatTimeSec / timeSec,
	};
}

/**
 * Build segments from Strava's `splits_metric` (one entry per kilometre, each
 * carrying the elevation change over that kilometre).
 *
 * @param {{distance: number, moving_time: number, elevation_difference: number}[]} splits
 * @returns {{distanceM: number, timeSec: number, gradient: number}[]}
 */
export function segmentsFromSplits(splits) {
	return (splits || [])
		.map((s) => {
			const distanceM = Number(s?.distance) || 0;
			return {
				distanceM,
				timeSec: Number(s?.moving_time) || 0,
				gradient: distanceM > 0 ? (Number(s?.elevation_difference) || 0) / distanceM : 0,
			};
		})
		.filter((s) => s.distanceM > 0 && s.timeSec > 0);
}

/**
 * Build segments from Strava streams. Uses `distance` (cumulative metres) and
 * `time` (cumulative seconds) to derive each sample's own delta, and
 * `grade_smooth` (percent) for gradient, falling back to the altitude delta
 * when grade isn't present.
 *
 * @param {{time?: number[], distance?: number[], grade_smooth?: number[], altitude?: number[]}} streams
 * @returns {{distanceM: number, timeSec: number, gradient: number}[]}
 */
export function segmentsFromStreams(streams) {
	const time = streams?.time;
	const distance = streams?.distance;
	if (!Array.isArray(time) || !Array.isArray(distance)) return [];

	const grade = streams.grade_smooth;
	const altitude = streams.altitude;
	const segments = [];

	for (let i = 1; i < time.length && i < distance.length; i++) {
		const distanceM = distance[i] - distance[i - 1];
		const timeSec = time[i] - time[i - 1];
		if (!(distanceM > 0) || !(timeSec > 0)) continue;

		let gradient = 0;
		if (Array.isArray(grade) && Number.isFinite(grade[i])) {
			gradient = grade[i] / 100; // Strava reports grade as a percentage
		} else if (Array.isArray(altitude) && Number.isFinite(altitude[i]) && Number.isFinite(altitude[i - 1])) {
			gradient = (altitude[i] - altitude[i - 1]) / distanceM;
		}
		segments.push({ distanceM, timeSec, gradient });
	}
	return segments;
}

/**
 * Best-available GAP for one activity: per-sample streams when we have them,
 * per-kilometre splits otherwise, and a flat-pace fallback so a treadmill run
 * with neither still reports something usable.
 *
 * Segments decide *how much* the terrain cost, but not what it's applied to.
 * The activity's own moving time is the anchor, because summed stream deltas
 * are not the run's duration: Strava's `time` stream is elapsed, so dropping
 * stopped and noisy samples above leaves a total that's near moving time on a
 * clean trace and well short of it on a messy one. Anchoring keeps GAP
 * comparable to the raw pace shown beside it — the two now differ only by
 * gradient, which is the entire point of the metric.
 *
 * @param {{streams?: object, splits?: object[], distanceM?: number, movingTimeSec?: number}} activity
 * @returns {{gapPaceSecPerKm: number, paceSecPerKm: number, adjustment: number,
 *   source: string} | null}
 */
export function activityGap(activity) {
	const distanceM = Number(activity?.distanceM) || 0;
	const movingTimeSec = Number(activity?.movingTimeSec) || 0;
	const anchorPace = distanceM > 0 && movingTimeSec > 0 ? movingTimeSec / (distanceM / 1000) : null;

	const measured = [
		["streams", gapFromSegments(segmentsFromStreams(activity?.streams))],
		["splits", gapFromSegments(segmentsFromSplits(activity?.splits))],
	].find(([, result]) => result);

	if (measured) {
		const [source, result] = measured;
		if (anchorPace === null) return { ...result, source };
		return {
			...result,
			paceSecPerKm: anchorPace,
			gapPaceSecPerKm: anchorPace * result.adjustment,
			source,
		};
	}

	if (anchorPace !== null) {
		return {
			gapPaceSecPerKm: anchorPace,
			paceSecPerKm: anchorPace,
			distanceM,
			flatTimeSec: movingTimeSec,
			timeSec: movingTimeSec,
			adjustment: 1,
			source: "flat",
		};
	}
	return null;
}
