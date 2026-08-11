// Numeric coercion that distinguishes "absent" from "zero".
//
// Number(null), Number(undefined) and Number("") are all 0, which throughout
// this engine is a genuinely different statement from the value being missing.
// A run with no heart-rate reading is not a run at 0 bpm; an unset zone floor
// is not a floor at 0. Coercing the two together produced real bugs — an
// unmonitored run scoring zero load, and dropped HR samples counting as easy
// zone-1 time — so every numeric field arriving from Strava or config goes
// through here first.

/**
 * @param {unknown} value
 * @returns {number} NaN when the value is absent, so Number.isFinite() rejects it.
 */
export function reading(value) {
	if (value === null || value === undefined || value === "") return NaN;
	return Number(value);
}

/**
 * @param {unknown} value
 * @returns {boolean} true only for a real, finite number.
 */
export function isReading(value) {
	return Number.isFinite(reading(value));
}
