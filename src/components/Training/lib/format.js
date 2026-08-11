// Display formatting for the training dashboard.
//
// Distances and durations reuse the shared Strava helpers; what's added here is
// the pace/time vocabulary specific to marathon training.

export { formatDistance, formatDuration } from "../../../lib/strava.js";

const pad = (n) => String(n).padStart(2, "0");

/**
 * Pace as m:ss/km.
 *
 * @param {number} secPerKm
 * @returns {string}
 */
export function pace(secPerKm) {
	if (!(secPerKm > 0)) return "—";
	const m = Math.floor(secPerKm / 60);
	const s = Math.round(secPerKm % 60);
	// Rounding 59.7s must roll the minute rather than print "5:60".
	return s === 60 ? `${m + 1}:00/km` : `${m}:${pad(s)}/km`;
}

/**
 * A race time as h:mm:ss.
 *
 * @param {number} sec
 * @returns {string}
 */
export function clock(sec) {
	if (!(sec > 0)) return "—";
	const total = Math.round(sec);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * A signed duration, for "4:32 ahead of goal" style deltas.
 *
 * @param {number} sec
 * @returns {string}
 */
export function signedClock(sec) {
	if (!Number.isFinite(sec) || sec === 0) return "on goal";
	const magnitude = clock(Math.abs(sec));
	return sec > 0 ? `${magnitude} over` : `${magnitude} under`;
}

/**
 * Kilometres, without noise decimals on big numbers.
 *
 * @param {number} metres
 * @returns {string}
 */
export function km(metres) {
	if (!Number.isFinite(metres)) return "—";
	const value = metres / 1000;
	return value >= 100 ? `${Math.round(value)} km` : `${value.toFixed(1)} km`;
}

/**
 * A percentage with no decimals.
 *
 * @param {number} value
 * @returns {string}
 */
export function pct(value) {
	return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

/**
 * Short weekday-and-date label, e.g. "Mon 11 Aug".
 *
 * @param {string} dayKey
 * @returns {string}
 */
export function shortDate(dayKey) {
	if (!dayKey) return "";
	const date = new Date(`${String(dayKey).slice(0, 10)}T12:00:00Z`);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en-GB", {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
}

/**
 * Weekday abbreviation, e.g. "Mon".
 *
 * @param {string} dayKey
 * @returns {string}
 */
export function weekday(dayKey) {
	if (!dayKey) return "";
	const date = new Date(`${String(dayKey).slice(0, 10)}T12:00:00Z`);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

/**
 * Month-and-day label for chart axes.
 *
 * @param {string} dayKey
 * @returns {string}
 */
export function axisDate(dayKey) {
	if (!dayKey) return "";
	const date = new Date(`${String(dayKey).slice(0, 10)}T12:00:00Z`);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
