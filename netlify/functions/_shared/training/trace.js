// Pace and heart rate across a single run, at a finer grain than a kilometre.
//
// The stored splits answer "how did it go" one kilometre at a time, which is
// the wrong resolution for the sessions that are most worth looking at. An
// interval workout's whole shape — the reps, the recoveries, the heart rate
// climbing through each effort and falling between them — happens inside a
// single split and averages away to one number. A 4:59/km kilometre made of
// 400m at 3:50 and 600m of jogging reads identically to a steady 4:59.
//
// Resampled by distance rather than smoothed over time. Each point is the mean
// across a fixed slice of the run, which is exactly what a split already is,
// only shorter: no kernel, no window, and nothing invented between samples.
// The count is fixed rather than the slice, so the cost per run is bounded
// whether it's 5km or 35km — an interval session is short, and a long run has
// no 200m features to lose.
//
// The privacy line is the same one shape.js draws everywhere else, and it is
// the reason grade isn't here. Per-kilometre grade adjustment is already
// published and describes an effort; a hundred and twenty grade samples in
// distance order is an elevation profile, and an elevation profile is most of
// the way to naming the route. Pace and heart rate describe what the run cost
// its runner, which is all this chart is for.

import { MIN_SEGMENT_SPEED, MAX_SEGMENT_SPEED } from "./gap.js";

// How short a slice can get. Not a storage limit — a legibility one, and the
// number that decides what this chart is for.
//
// Pace is a reciprocal, so walking is a very long way from running on a linear
// axis: a jogged recovery is 6:30/km and a walked one is 13:00, which is
// further below a 3:30 rep than the rep is below the top of the plot. Slice a
// workout finely enough and one slice lands almost entirely inside a walk,
// takes its pace whole, and the axis stretches to reach it — leaving every rep
// squashed into the top tenth of the chart. Wider slices blend that walk with
// the running either side, which is what Strava's smoothed view does and why
// its recoveries bottom out around 8:00 rather than 13:00.
//
// 150m is about the shortest that survives it, and still gives four or five
// points to a 400m rep.
export const MIN_SLICE_M = 150;

// And an upper bound on the count, so a marathon costs the same as a 10k.
export const TRACE_POINTS = 120;

/**
 * Resample a run's streams into a fixed number of points across its distance.
 *
 * Stored as parallel arrays rather than an array of points: this sits in the
 * activity index, which is read whole on every build of the dashboard, and
 * three arrays of numbers cost about half what a hundred and twenty
 * `{m, pace, hr}` objects do once serialised.
 *
 * @param {object|null} streams keyed by type, as trainingSync fetches them.
 * @param {object} [options]
 * @param {number} [options.distanceM] the activity's own total, preferred over
 *   the last distance sample, which a GPS drop can leave short.
 * @param {number} [options.maxPoints]
 * @param {number} [options.minSliceM]
 * @returns {{m: number[], pace: (number|null)[], hr: (number|null)[]}|null}
 *   null when there's nothing to resample — a manual entry has no streams.
 *   `pace` is seconds per km and `hr` bpm; either can be null for a slice that
 *   measured neither.
 */
export function shapeTrace(
	streams,
	{ distanceM = 0, maxPoints = TRACE_POINTS, minSliceM = MIN_SLICE_M } = {},
) {
	const distance = streams?.distance;
	const time = streams?.time;
	if (!Array.isArray(distance) || !Array.isArray(time)) return null;
	if (distance.length < 2 || time.length !== distance.length) return null;

	const total = distanceM > 0 ? distanceM : Number(distance.at(-1));
	if (!(total > 0)) return null;

	const heartrate =
		Array.isArray(streams?.heartrate) && streams.heartrate.length === distance.length
			? streams.heartrate
			: null;

	// A short run gets fewer points at the same slice width rather than the
	// same points at a narrower one, so every chart reads at one grain.
	const points = Math.max(2, Math.min(maxPoints, Math.floor(total / minSliceM)));
	const slice = total / points;
	const sliceOf = (metres) => Math.min(points - 1, Math.max(0, Math.floor(metres / slice)));

	const movingSec = new Array(points).fill(0);
	const coveredM = new Array(points).fill(0);
	const beats = new Array(points).fill(0);
	const reads = new Array(points).fill(0);

	for (let i = 1; i < distance.length; i++) {
		const d = Number(distance[i]) - Number(distance[i - 1]);
		const t = Number(time[i]) - Number(time[i - 1]);
		if (!(d > 0) || !(t > 0)) continue;

		// The same bounds gap.js uses, for the same reason: Strava's `time` is
		// elapsed, so a stop at a crossing arrives as one sample covering
		// minutes, and a signal re-acquisition as one covering a street.
		const speed = d / t;
		if (speed < MIN_SEGMENT_SPEED || speed > MAX_SEGMENT_SPEED) continue;

		// Samples are a second or two apart and a slice is tens of metres, so
		// a segment falls inside one slice essentially always. Attributing it
		// to the one it ended in is exact often enough not to be worth
		// splitting a segment across a boundary.
		const at = sliceOf(Number(distance[i]));
		movingSec[at] += t;
		coveredM[at] += d;
	}

	// Heart rate counts every sample, including the ones the speed filter just
	// dropped. Standing at the end of a rep is precisely when the interesting
	// thing is happening — a recovery is a heart rate coming down — and
	// discarding it alongside the pace would erase the reason to plot it.
	if (heartrate) {
		for (const [i, metres] of distance.entries()) {
			const bpm = Number(heartrate[i]);
			if (!(bpm > 0)) continue;
			const at = sliceOf(Number(metres));
			beats[at] += bpm;
			reads[at] += 1;
		}
	}

	const m = [];
	const pace = [];
	const hr = [];
	for (let i = 0; i < points; i++) {
		// The middle of the slice, since the value is its average and pinning
		// it to either edge would shift the whole trace half a slice.
		m.push(Math.round((i + 0.5) * slice));
		pace.push(coveredM[i] > 0 ? Math.round(movingSec[i] / (coveredM[i] / 1000)) : null);
		hr.push(reads[i] > 0 ? Math.round(beats[i] / reads[i]) : null);
	}

	const measured = pace.some((v) => v !== null) || hr.some((v) => v !== null);
	return measured ? { m, pace, hr } : null;
}
