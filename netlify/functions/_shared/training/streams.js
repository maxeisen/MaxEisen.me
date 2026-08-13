// What counts as a measurement, when the recording has holes in it.
//
// Strava's `time` stream is elapsed, and a watch that auto-pauses stops writing
// samples while it's paused. So a stop doesn't arrive as a run of slow samples
// — it arrives as a single interval spanning the whole thing. Ten minutes at
// the end of an interval session came back as one dt of 622 seconds, and
// anything that sums dt books all ten of those minutes into whatever the heart
// happened to be doing when recording resumed. On that run it put twenty
// minutes of standing into zone one and reported the session as 49% easy;
// without the gaps it's 33%.
//
// Ten seconds, because the sample rate is nowhere near it. Across a dozen of
// this athlete's runs there are 34,261 intervals of exactly one second, none at
// all between two and ten, and then the gaps: 11, 30, 34, 76, 79, 175, 258,
// 622. The cliff is unmistakable and the threshold sits an order of magnitude
// above the cadence, so it cannot discard real running.
//
// That margin is the thing to check if it ever needs revisiting: a watch set to
// smart recording samples every few seconds instead of every second, and this
// would start eating measurements rather than gaps.
export const MAX_SAMPLE_GAP_SEC = 10;

/**
 * Is this interval a hole in the recording rather than time that was measured?
 *
 * Time inside a gap is not counted as anything — not as easy, not as hard, not
 * as slow. Nothing was recorded, so there's nothing to attribute, and guessing
 * from the sample on either side is how ten minutes of standing became easy
 * running in the first place.
 *
 * @param {number} dtSec interval between two consecutive samples.
 * @returns {boolean}
 */
export function isRecordingGap(dtSec) {
	return dtSec > MAX_SAMPLE_GAP_SEC;
}
