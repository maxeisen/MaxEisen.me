// Display formatting for the training dashboard.
//
// Distances and durations reuse the shared Strava helpers; what's added here is
// the pace/time vocabulary specific to marathon training.

// Imported rather than re-exported straight through, because the unit
// formatting below needs formatDuration as a local binding.
import { formatDistance, formatDuration } from "../../../lib/strava.js";

export { formatDistance, formatDuration };

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
 * Average speed as km/h — how a ride is read, where a runner's min/km would be
 * a number nobody has an instinct for.
 *
 * @param {number} distanceM
 * @param {number} movingTimeSec
 * @returns {string}
 */
export function speed(distanceM, movingTimeSec) {
	if (!(distanceM > 0) || !(movingTimeSec > 0)) return "—";
	return `${(distanceM / 1000 / (movingTimeSec / 3600)).toFixed(1)} km/h`;
}

/**
 * How long something took, spelled so it can't be read as a distance.
 *
 * formatDuration's "48m" is fine in a sentence and fine beside an "h", but a
 * headline stat sits next to "9.30 km" in a row of large numbers, and there
 * "48m" is forty-eight metres to anyone reading quickly. Under the hour it
 * says "min"; over it, the "h" does that work already and "1h15m" reads as one
 * time rather than two units.
 *
 * @param {number} sec
 * @returns {string}
 */
export function timeTaken(sec) {
	if (!(sec > 0)) return "—";
	// Minutes first, so 59m30s rolls the hour instead of printing "60min".
	const total = Math.round(sec / 60);
	const h = Math.floor(total / 60);
	return h > 0 ? `${h}h${pad(total % 60)}m` : `${total}min`;
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
 * A race time rounded to the minute, as h:mm.
 *
 * Marathon projections are not precise to the second. The headline and the
 * likely range use this so the page does not pretend they are.
 *
 * @param {number} sec
 * @returns {string}
 */
export function clockMinutes(sec) {
	if (!(sec > 0)) return "—";
	const total = Math.round(sec / 60);
	const h = Math.floor(total / 60);
	const m = total % 60;
	return h > 0 ? `${h}:${pad(m)}` : `${m} min`;
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

// A measured number to one decimal, with the decimal dropped when it's a
// whole number anyway. Rounding harder than this makes a rule contradict
// itself: a long run at 35.4% of the week, flagged for exceeding a 35%
// guideline, prints as "35% vs 35%" and reads as a rule that fired over
// nothing. The thresholds are all whole numbers, so only the measurement ever
// carries the decimal and the pair stays easy to compare.
function quantity(value) {
	return String(Number(value.toFixed(1)));
}

// How each unit is said. Symbols bind to their number, so both halves of a
// comparison carry them; words are said once at the end, because "7 bpm vs
// 3 bpm" is how a form prints and not how anyone speaks.
const UNITS = {
	duration: { each: (v) => formatDuration(v) },
	percent: { each: (v) => `${quantity(v)}%` },
	ratio: { each: (v) => `${v.toFixed(2)}×` },
	bpm: { each: quantity, trailing: " bpm" },
	days: { each: (v) => String(Math.round(v)), trailing: " days" },
	// Form is the one genuinely unitless measure on the page: a difference
	// between two loads on an arbitrary scale.
	none: { each: quantity },
};

/**
 * A measured value against the threshold it crossed, as the recommendation
 * panel prints it: "5.4% vs 5%", "3h 50m vs 3h 40m", "7 vs 3 bpm".
 *
 * Without the unit these read as bare numbers in a list where the row above
 * is a ratio and the row below is a count of heartbeats — the reader is left
 * to infer which from the prose, which is exactly the work the readout is
 * supposed to save them.
 *
 * @param {number} metric
 * @param {number} [threshold] omitted for rules that report a value rather
 *   than a crossing.
 * @param {string} [unit] one of duration, percent, ratio, bpm, days.
 * @returns {string|null} null when there's no number to show.
 */
export function readout(metric, threshold, unit) {
	if (!Number.isFinite(metric)) return null;
	const { each, trailing = "" } = UNITS[unit] || UNITS.none;
	const value = each(metric);
	return Number.isFinite(threshold)
		? `${value} vs ${each(threshold)}${trailing}`
		: `${value}${trailing}`;
}

// A sentence ends at punctuation followed by a space and the start of the
// next one. Deliberately not a lookbehind: Safari only learned those in 16.4,
// and an unsupported one is a parse error that takes the whole bundle with it
// rather than a formatting bug on one panel.
const SENTENCE_BREAK = /[.!?]\s+[A-Z0-9]/;

/**
 * Split prose into its opening sentence and everything after it.
 *
 * The recommendations lead with the measurement and follow with why it
 * matters and what to do — so the first sentence is the part that earns its
 * place on screen, and the rest is what a reader asks for.
 *
 * @param {string} text
 * @returns {{lead: string, rest: string}} rest is "" for a single sentence,
 *   which is the signal not to offer an expander at all.
 */
export function splitLead(text) {
	const trimmed = String(text ?? "").trim();
	const at = trimmed.search(SENTENCE_BREAK);
	if (at < 0) return { lead: trimmed, rest: "" };
	return { lead: trimmed.slice(0, at + 1), rest: trimmed.slice(at + 1).trim() };
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
