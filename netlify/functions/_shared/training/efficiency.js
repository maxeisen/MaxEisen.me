// Aerobic efficiency and decoupling.
//
// Efficiency factor is speed per heartbeat: how much pace you get for a given
// cardiac cost. Rising EF across a block, at consistent heart rates, is the
// cleanest single signal that base fitness is actually improving — more
// trustworthy than pace alone, which flatters cool days and flat routes.
//
// Decoupling (often written Pa:HR) is EF in the first half of a run against EF
// in the second. On an easy long run the two should stay close; a large drop
// means heart rate drifted up while pace fell away, which is what running out
// of aerobic endurance looks like. Under ~5% is the usual marker for being
// aerobically ready for the distance. It's the single most useful thing a long
// run tells you, and it needs streams rather than summary averages to see.
//
// Both use grade-adjusted speed, so a hilly second half doesn't masquerade as
// fatigue.

import { gradeFactor } from "./gap.js";
import { reading } from "./num.js";
import { isRecordingGap } from "./streams.js";

// Below this there isn't enough signal for the halves to mean anything.
const MIN_SAMPLES = 20;

/**
 * Speed per heartbeat, scaled to a readable magnitude.
 *
 * @param {number} speedMps grade-adjusted metres per second.
 * @param {number} hr
 * @returns {number|null} metres per minute per beat.
 */
export function efficiencyFactor(speedMps, hr) {
	const speed = reading(speedMps);
	const beats = reading(hr);
	if (!(speed > 0) || !(beats > 0)) return null;
	return (speed * 60) / beats;
}

// Mean grade-adjusted speed and mean HR across a slice of samples.
function sliceEfficiency(samples) {
	let distanceM = 0;
	let timeSec = 0;
	let beatSeconds = 0;

	for (const s of samples) {
		distanceM += s.distanceM * gradeFactor(s.gradient);
		timeSec += s.timeSec;
		beatSeconds += s.hr * s.timeSec;
	}
	if (!(timeSec > 0) || !(beatSeconds > 0)) return null;
	const meanHr = beatSeconds / timeSec;
	return efficiencyFactor(distanceM / timeSec, meanHr);
}

// Pair the streams into per-sample deltas carrying HR, dropping anything
// without both a movement and a heartbeat.
function samplesFromStreams(streams) {
	const time = streams?.time;
	const distance = streams?.distance;
	const hr = streams?.heartrate;
	if (!Array.isArray(time) || !Array.isArray(distance) || !Array.isArray(hr)) return [];

	const grade = streams.grade_smooth;
	const samples = [];
	for (let i = 1; i < time.length && i < distance.length && i < hr.length; i++) {
		const timeSec = time[i] - time[i - 1];
		const distanceM = distance[i] - distance[i - 1];
		const beats = reading(hr[i]);
		// A pause clears the "moved at all" test on a metre of GPS drift and
		// then arrives here as one sample worth ten minutes — enough to drag
		// the efficiency of whichever half holds it toward zero, and to move
		// the halfway line by a sixth of the run.
		if (!(timeSec > 0) || isRecordingGap(timeSec)) continue;
		if (!(distanceM > 0) || !(beats > 0)) continue;
		samples.push({
			timeSec,
			distanceM,
			hr: beats,
			gradient: Array.isArray(grade) && Number.isFinite(grade[i]) ? grade[i] / 100 : 0,
		});
	}
	return samples;
}

/**
 * Aerobic decoupling across a run.
 *
 * @param {{time?: number[], distance?: number[], heartrate?: number[], grade_smooth?: number[]}} streams
 * @returns {{decouplingPct: number, firstHalfEf: number, secondHalfEf: number}|null}
 */
export function aerobicDecoupling(streams) {
	const samples = samplesFromStreams(streams);
	if (samples.length < MIN_SAMPLES) return null;

	// Split by elapsed time rather than sample count so a stretch of dense
	// sampling doesn't skew where the halfway line falls.
	const totalTime = samples.reduce((sum, s) => sum + s.timeSec, 0);
	let running = 0;
	let splitAt = 0;
	for (let i = 0; i < samples.length; i++) {
		running += samples[i].timeSec;
		if (running >= totalTime / 2) {
			splitAt = i + 1;
			break;
		}
	}
	if (splitAt <= 0 || splitAt >= samples.length) return null;

	const firstHalfEf = sliceEfficiency(samples.slice(0, splitAt));
	const secondHalfEf = sliceEfficiency(samples.slice(splitAt));
	if (!(firstHalfEf > 0) || !(secondHalfEf > 0)) return null;

	return {
		decouplingPct: ((firstHalfEf - secondHalfEf) / firstHalfEf) * 100,
		firstHalfEf,
		secondHalfEf,
	};
}

/**
 * Whole-run efficiency factor from summary values, for trending across a block.
 *
 * @param {{gapPaceSecPerKm?: number, averageHr?: number}} activity
 * @returns {number|null}
 */
export function activityEfficiency(activity) {
	const gap = reading(activity?.gapPaceSecPerKm);
	if (!(gap > 0)) return null;
	return efficiencyFactor(1000 / gap, activity?.averageHr);
}

// Runs either side of this many points are averaged into the trend line.
const TREND_WINDOW = 5;

// Enough runs on each side for "improving" to mean something rather than
// describing which day happened to be cool.
const MIN_TREND_RUNS = 6;

/**
 * Efficiency factor across a block, with a smoothed trend line.
 *
 * Only aerobic runs are included. EF varies with intensity by construction, so
 * mixing interval sessions into the series produces a sawtooth that moves with
 * the week's workout schedule rather than with fitness — the opposite of what
 * the chart is for. `aerobicCeilingHr` is the zone 4 floor, so tempo and easy
 * running both count and only genuinely hard efforts are excluded.
 *
 * @param {{startDateLocal?: string, averageHr?: number, gapPaceSecPerKm?: number}[]} activities
 * @param {{aerobicCeilingHr?: number}} [options]
 * @returns {{points: {date: string, ef: number}[], trend: {date: string, ef: number}[],
 *   changePct: number|null, first: number|null, latest: number|null}}
 */
export function efficiencyTrend(activities, { aerobicCeilingHr = null } = {}) {
	const ceiling = reading(aerobicCeilingHr);
	const points = [];

	for (const a of activities || []) {
		const hr = reading(a?.averageHr);
		if (!(hr > 0)) continue;
		if (Number.isFinite(ceiling) && hr >= ceiling) continue;
		const ef = activityEfficiency(a);
		const date = String(a?.startDateLocal || "").slice(0, 10);
		if (!(ef > 0) || !date) continue;
		points.push({ date, ef });
	}

	points.sort((a, b) => a.date.localeCompare(b.date));

	const trend = points.map((p, i) => {
		const from = Math.max(0, i - (TREND_WINDOW - 1));
		const window = points.slice(from, i + 1);
		return { date: p.date, ef: window.reduce((sum, w) => sum + w.ef, 0) / window.length };
	});

	// Compare the ends of the smoothed line rather than the raw first and last
	// runs, which would let one outlier decide whether the block looks good.
	let changePct = null;
	let first = null;
	let latest = null;
	if (trend.length >= MIN_TREND_RUNS) {
		const span = Math.floor(trend.length / 3);
		const head = trend.slice(0, span);
		const tail = trend.slice(-span);
		first = head.reduce((sum, p) => sum + p.ef, 0) / head.length;
		latest = tail.reduce((sum, p) => sum + p.ef, 0) / tail.length;
		if (first > 0) changePct = ((latest - first) / first) * 100;
	}

	return { points, trend, changePct, first, latest };
}
