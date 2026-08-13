// The two summaries this engine takes of a pile of numbers.
//
// Medians rather than means, nearly everywhere: a training block contains a
// week off with the flu, a night the ring was charging, and a run that Strava
// filed at 4:00/km because the GPS thought you swam the Don. A mean carries all
// three into the answer and a median doesn't, which matters when the point of
// the number is "what's normal for you".

import { reading } from "./num.js";

/**
 * @param {number[]} values
 * @returns {number|null} null for an empty list, rather than a number that
 *   would read as a real answer.
 */
export function median(values) {
	if (!values || values.length === 0) {
		return null;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	const lower = sorted.at(mid - 1);
	const upper = sorted.at(mid);
	return sorted.length % 2 ? upper : (lower + upper) / 2;
}

/**
 * The finite readings of one field across a list of records.
 *
 * Absent readings are dropped rather than zeroed, for the reason set out in
 * num.js: a night with no heart rate is not a night at 0 bpm.
 *
 * @param {object[]} records
 * @param {string} field
 * @returns {number[]}
 */
export function readingsOf(records, field) {
	return (records || [])
		.map((record) => reading(record?.[field]))
		.filter((value) => Number.isFinite(value));
}
