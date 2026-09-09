// Display formatting for the training dashboard.
// Distances and durations reuse src/lib/strava.js; pace/time vocabulary is local.

import { formatDistance, formatDuration } from "../../../lib/strava.js";

export { formatDistance, formatDuration };

const pad = (n) => String(n).padStart(2, "0");

function utcNoon(dayKey) {
	const date = new Date(`${String(dayKey ?? "").slice(0, 10)}T12:00:00Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** Pace as m:ss/km. */
export function pace(secPerKm) {
	if (!(secPerKm > 0)) return "—";
	const m = Math.floor(secPerKm / 60);
	const s = Math.round(secPerKm % 60);
	return s === 60 ? `${m + 1}:00/km` : `${m}:${pad(s)}/km`;
}

/** Average speed as km/h — how a ride is read. */
export function speed(distanceM, movingTimeSec) {
	if (!(distanceM > 0) || !(movingTimeSec > 0)) return "—";
	return `${(distanceM / 1000 / (movingTimeSec / 3600)).toFixed(1)} km/h`;
}

/**
 * How long something took. formatDuration's "48m" sits next to "9.30 km" in
 * headlines and reads as metres; under an hour we say "min".
 */
export function timeTaken(sec) {
	if (!(sec > 0)) return "—";
	const total = Math.round(sec / 60);
	const h = Math.floor(total / 60);
	return h > 0 ? `${h}h${pad(total % 60)}m` : `${total}min`;
}

/** A race time as h:mm:ss. */
export function clock(sec) {
	if (!(sec > 0)) return "—";
	const total = Math.round(sec);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Signed duration, for "4:32 under goal" style deltas. */
export function signedClock(sec) {
	if (!Number.isFinite(sec) || sec === 0) return "on goal";
	const magnitude = clock(Math.abs(sec));
	return sec > 0 ? `${magnitude} over` : `${magnitude} under`;
}

export function km(metres) {
	if (!Number.isFinite(metres)) return "—";
	const value = metres / 1000;
	return value >= 100 ? `${Math.round(value)} km` : `${value.toFixed(1)} km`;
}

export function pct(value) {
	return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

/** Short weekday-and-date, e.g. "Mon 11 Aug". */
export function shortDate(dayKey) {
	const date = utcNoon(dayKey);
	return date
		? date.toLocaleDateString("en-GB", {
			weekday: "short",
			day: "numeric",
			month: "short",
			timeZone: "UTC",
		})
		: "";
}

export function weekday(dayKey) {
	const date = utcNoon(dayKey);
	return date
		? date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })
		: "";
}

export function axisDate(dayKey) {
	const date = utcNoon(dayKey);
	return date
		? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
		: "";
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

/** A Monday's week as the range it covers: "17–23 Aug" or "31 Aug – 6 Sept". */
export function weekRange(weekStart) {
	const start = utcNoon(weekStart);
	return start ? span(start, sixDaysOn(start)) : "";
}

const NAMED_DAYS = new Map([
	[0, "Today"],
	[1, "Yesterday"],
]);

const isDayCount = (days) => Number.isFinite(days) && days >= 0;

function weeksAgo(days) {
	const weeks = Math.round(days / 7);
	return weeks === 1 ? "Last week" : `${weeks} weeks ago`;
}

export function daysAgo(days) {
	if (!isDayCount(days)) return "";
	if (NAMED_DAYS.has(days)) return NAMED_DAYS.get(days);
	if (days < 7) return `${days} days ago`;
	return weeksAgo(days);
}

export function signed(value, digits = 1) {
	if (!Number.isFinite(value)) return "—";
	const rounded = Number(value.toFixed(digits));
	const magnitude = Math.abs(rounded).toFixed(digits);
	if (rounded > 0) return `+${magnitude}`;
	return rounded < 0 ? `-${magnitude}` : magnitude;
}

function quantity(value) {
	return String(Number(value.toFixed(1)));
}

const UNITS = {
	duration: { each: (v) => formatDuration(v) },
	percent: { each: (v) => `${quantity(v)}%` },
	ratio: { each: (v) => `${v.toFixed(2)}×` },
	bpm: { each: quantity, trailing: " bpm" },
	days: { each: (v) => String(Math.round(v)), trailing: " days" },
	none: { each: quantity },
};

/** Measured value against the threshold it crossed: "5.4% vs 5%", "7 vs 3 bpm". */
export function readout(metric, threshold, unit) {
	if (!Number.isFinite(metric)) return null;
	const { each, trailing = "" } = UNITS[unit] || UNITS.none;
	const value = each(metric);
	return Number.isFinite(threshold)
		? `${value} vs ${each(threshold)}${trailing}`
		: `${value}${trailing}`;
}

// Not a lookbehind: Safari only learned those in 16.4, and an unsupported
// one is a parse error that takes the whole bundle with it.
const SENTENCE_BREAK = /[.!?]\s+[A-Z0-9]/;

/** Opening sentence and everything after it. rest is "" for a single sentence. */
export function splitLead(text) {
	const trimmed = String(text ?? "").trim();
	const at = trimmed.search(SENTENCE_BREAK);
	if (at < 0) return { lead: trimmed, rest: "" };
	return { lead: trimmed.slice(0, at + 1), rest: trimmed.slice(at + 1).trim() };
}
