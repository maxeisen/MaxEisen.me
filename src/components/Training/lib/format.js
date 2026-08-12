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

/** The day key as a UTC-noon Date, or null if there isn't a usable one. */
function utcNoon(dayKey) {
	const date = new Date(`${String(dayKey ?? "").slice(0, 10)}T12:00:00Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

function sixDaysOn(start) {
	const end = new Date(start);
	end.setUTCDate(end.getUTCDate() + 6);
	return end;
}

function span(start, end) {
	const day = (d) => d.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" });
	const dayMonth = (d) =>
		d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

	return start.getUTCMonth() === end.getUTCMonth()
		? `${day(start)}–${dayMonth(end)}`
		: `${dayMonth(start)} – ${dayMonth(end)}`;
}

/**
 * The week a Monday starts, as the range it actually covers: "17–23 Aug",
 * or "31 Aug – 6 Sept" where the week straddles two months.
 *
 * A training week is seven days, and labelling it with its Monday alone asks
 * the reader to do the arithmetic every time they want to know whether a
 * given Saturday falls inside it.
 *
 * @param {string} weekStart Monday day key.
 * @returns {string}
 */
export function weekRange(weekStart) {
	const start = utcNoon(weekStart);
	return start ? span(start, sixDaysOn(start)) : "";
}

// The days that have a name rather than a count. A Map rather than an object
// so looking one up by a number isn't an indexing expression.
const NAMED_DAYS = new Map([
	[0, "Today"],
	[1, "Yesterday"],
]);

// Number.isFinite, not `>= 0`: null compares as zero, and "null days ago" is
// how that gets found out.
const isDayCount = (days) => Number.isFinite(days) && days >= 0;

function weeksAgo(days) {
	const weeks = Math.round(days / 7);
	return weeks === 1 ? "Last week" : `${weeks} weeks ago`;
}

/**
 * How long ago a day was, in the words you'd use out loud.
 *
 * @param {number} days whole days between the day and today.
 * @returns {string}
 */
export function daysAgo(days) {
	if (!isDayCount(days)) {
		return "";
	}
	if (NAMED_DAYS.has(days)) {
		return NAMED_DAYS.get(days);
	}
	if (days < 7) {
		return `${days} days ago`;
	}
	return weeksAgo(days);
}

/**
 * A number with its sign kept, for deltas where "+0.3" and "0.3" mean
 * different things.
 *
 * @param {number} value
 * @param {number} [digits]
 * @returns {string}
 */
export function signed(value, digits = 1) {
	if (!Number.isFinite(value)) {
		return "—";
	}
	// Round first, then read the sign off the result: -0.04 to one decimal is
	// zero, and "-0.0" reads as a decrease that didn't happen.
	const rounded = Number(value.toFixed(digits));
	const magnitude = Math.abs(rounded).toFixed(digits);
	if (rounded > 0) {
		return `+${magnitude}`;
	}
	return rounded < 0 ? `-${magnitude}` : magnitude;
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
