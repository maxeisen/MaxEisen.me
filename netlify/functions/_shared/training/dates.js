// Calendar helpers for the training engine.
//
// Everything works on plain `YYYY-MM-DD` strings parsed as UTC. Using real
// local Date arithmetic would make day counts wrong twice a year: adding 24
// hours across a DST boundary lands on the same calendar day or skips one, and
// a training block spanning March or November would quietly gain or lose a day
// in every rolling average. Since a run's calendar day is already decided by
// the time we get here (Strava hands us a local start date), the arithmetic
// only needs to be a stable day counter.

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Extract the `YYYY-MM-DD` day key from a date or ISO timestamp.
 *
 * @param {string|Date} value
 * @returns {string|null}
 */
export function toDayKey(value) {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
	}
	const day = String(value || "").slice(0, 10);
	return DAY_RE.test(day) ? day : null;
}

function toUtcMs(dayKey) {
	const day = toDayKey(dayKey);
	if (!day) return NaN;
	const [y, m, d] = day.split("-").map(Number);
	return Date.UTC(y, m - 1, d);
}

/**
 * @param {string} dayKey
 * @param {number} n may be negative.
 * @returns {string|null}
 */
export function addDays(dayKey, n) {
	const ms = toUtcMs(dayKey);
	if (Number.isNaN(ms)) return null;
	return new Date(ms + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Whole days from `a` to `b`, positive when `b` is later.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number|null}
 */
export function daysBetween(a, b) {
	const from = toUtcMs(a);
	const to = toUtcMs(b);
	if (Number.isNaN(from) || Number.isNaN(to)) return null;
	return Math.round((to - from) / DAY_MS);
}

/**
 * The Monday on or before a day. Training weeks run Monday to Sunday so a
 * Sunday long run closes the week it belongs to rather than opening the next.
 *
 * @param {string} dayKey
 * @returns {string|null}
 */
export function mondayOf(dayKey) {
	const ms = toUtcMs(dayKey);
	if (Number.isNaN(ms)) return null;
	const dow = new Date(ms).getUTCDay(); // 0 = Sunday
	const backToMonday = dow === 0 ? 6 : dow - 1;
	return addDays(dayKey, -backToMonday);
}

/**
 * Every day from `from` to `to`, inclusive.
 *
 * @param {string} from
 * @param {string} to
 * @returns {string[]}
 */
export function eachDay(from, to) {
	const span = daysBetween(from, to);
	if (span === null || span < 0) return [];
	const days = [];
	for (let i = 0; i <= span; i++) days.push(addDays(from, i));
	return days;
}
