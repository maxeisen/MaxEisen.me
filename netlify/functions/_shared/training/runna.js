// The training plan, read from Runna's calendar feed.
//
// Runna has no API, but it publishes the plan as an iCalendar subscription
// (Connected Apps & Watches → Calendar Sync). Skipping or moving a workout in
// the app rewrites the feed, so reading it on a schedule keeps /running in step
// with the plan as it actually stands instead of as it was first typed up.
//
// What the feed holds, and what this keeps of it:
//
//   UPCOMING_PLAN_WORKOUT-…_plan_week_<n>_<TYPE>_<i>
//       Every remaining session through race day, dated to the day. Runna
//       only writes distance and structure about four weeks out; further
//       ahead a session is just its type and an estimated duration. Those
//       weeks carry no distance targets yet and fill in as Runna fills them.
//   COMPLETED_PLAN_WORKOUT / COMPLETED_NON_PLAN_WORKOUT
//       Finished activities, with GEO and LOCATION fields — the start point
//       of every run. Strava is already the record of what was run, so these
//       are only read for a planned session's title and date (see
//       completedSessions), and nothing positional is ever parsed.
//
// A finished day drops out of UPCOMING, so the plan for the past has to be
// remembered rather than re-read: mergeRunnaPlan freezes each day once it has
// gone by. The feed URL is a bearer secret (RUNNA_ICS_URL) and never reaches a
// response.

import { addDays, mondayOf } from "./dates.js";

// Only the properties used below are kept, so GEO/LOCATION can't be passed on
// by accident however the result is used later.
const KEPT = new Set(["UID", "DTSTART", "SUMMARY", "DESCRIPTION", "X-WORKOUT-ESTIMATED-DURATION"]);

function unescapeText(value) {
	return value.replace(/\\([nN,;\\])/g, (_, c) => (c === "n" || c === "N" ? "\n" : c));
}

/**
 * Parse the VEVENTs of an iCalendar document.
 *
 * @param {string} text
 * @returns {{uid: string, date: string|null, summary: string, description: string, durationSec: number|null}[]}
 */
export function parseIcs(text) {
	if (typeof text !== "string") return [];
	// RFC 5545 folding: a line starting with a space or tab continues the last.
	const lines = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
	const events = [];
	let current = null;
	for (const line of lines) {
		if (line === "BEGIN:VEVENT") {
			current = {};
		} else if (line === "END:VEVENT") {
			if (current) events.push(current);
			current = null;
		} else if (current) {
			const colon = line.indexOf(":");
			if (colon <= 0) continue;
			const name = line.slice(0, colon).split(";")[0].toUpperCase();
			if (KEPT.has(name)) current[name] = line.slice(colon + 1);
		}
	}
	return events.map((e) => {
		const ymd = /^(\d{4})(\d{2})(\d{2})/.exec(e.DTSTART || "");
		const duration = Number(e["X-WORKOUT-ESTIMATED-DURATION"]);
		return {
			uid: e.UID || "",
			date: ymd ? `${ymd[1]}-${ymd[2]}-${ymd[3]}` : null,
			summary: unescapeText(e.SUMMARY || "").trim(),
			description: unescapeText(e.DESCRIPTION || ""),
			durationSec: Number.isFinite(duration) && duration > 0 ? duration : null,
		};
	});
}

// Runna's workout types → the plan vocabulary plan.js counts volume from.
// Hills, fartleks and time trials are quality sessions with a warm-up and
// cool-down around them — the same shape as intervals, and counted as such.
const RUNNA_TYPES = {
	EASY_RUN: "easy run",
	RECOVERY_RUN: "easy run",
	LONG_RUN: "long run",
	TEMPO: "tempo",
	INTERVALS: "intervals",
	HILLS: "intervals",
	TAPER_INTERVALS: "intervals",
	TIME_TRIAL: "intervals",
	RACE: "race",
	LEGS_AND_CORE: "strength",
	UPPER_AND_CORE: "strength",
	FULL_BODY: "strength",
};

const UPCOMING_RE = /^UPCOMING_PLAN_WORKOUT-.*_plan_week_(\d+)_([A-Z_]+?)_\d+$/;
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function weekdayOf(dayKey) {
	const [y, m, d] = dayKey.split("-").map(Number);
	return WEEKDAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
}

// "🏃 13km Hilly Long Run • 13km" → name "13km Hilly Long Run", suffix "13km".
function splitSummary(summary) {
	const clean = summary.replace(/^[^\p{L}\p{N}]+/u, "");
	const [name, ...rest] = clean.split("•").map((s) => s.trim());
	return { name: name || "", suffix: rest.join(" • ") };
}

// Distance comes from the description's header line ("Intervals • 7km • 35m -
// 45m") or the title suffix; a leading "13km" in the name is the fallback.
function distanceKm(summary, description) {
	const header = description.split("\n")[0] || "";
	const from = (s) => {
		const m = /(?:^|•)\s*(\d+(?:\.\d+)?)\s*km\b/i.exec(s);
		return m ? Number(m[1]) : null;
	};
	return from(header) ?? from(summary.split("•").slice(1).join("•")) ?? from(splitSummary(summary).name);
}

function detailFor(summary, durationSec, km) {
	const { name, suffix } = splitSummary(summary);
	if (km != null) return name;
	// No distance yet: say how long Runna expects it to take instead.
	if (suffix && !/km\b/i.test(suffix)) return `${name} (${suffix})`;
	if (durationSec) return `${name} (~${Math.round(durationSec / 60)}m)`;
	return name;
}

function sessionFrom(event, type) {
	const km = type === "strength" ? null : distanceKm(event.summary, event.description);
	const session = {
		date: event.date,
		day: weekdayOf(event.date),
		type,
		detail: detailFor(event.summary, event.durationSec, km),
	};
	if (km != null) session.distanceKm = km;
	if (event.durationSec) session.durationMin = Math.round(event.durationSec / 60);
	return session;
}

/**
 * The upcoming plan in the feed: dated sessions, the block's first Monday
 * (from Runna's week numbering) and the race, if the plan ends in one.
 *
 * @param {ReturnType<typeof parseIcs>} events
 * @returns {{sessions: object[], blockStart: string|null, race: object|null}}
 */
export function upcomingPlan(events) {
	const sessions = [];
	let blockStart = null;
	let race = null;
	for (const event of events || []) {
		const m = UPCOMING_RE.exec(event.uid);
		if (!m || !event.date) continue;
		const type = RUNNA_TYPES[m[2]] || (event.summary.startsWith("🏋") ? "strength" : "easy run");
		const session = sessionFrom(event, type);
		sessions.push(session);

		const start = addDays(mondayOf(event.date), -7 * (Number(m[1]) - 1));
		if (start && (!blockStart || start < blockStart)) blockStart = start;
		if (m[2] === "RACE") {
			race = {
				name: splitSummary(event.summary).name,
				date: event.date,
				...(session.distanceKm ? { distanceM: Math.round(session.distanceKm * 1000) } : {}),
			};
		}
	}
	sessions.sort((a, b) => a.date.localeCompare(b.date));
	return { sessions, blockStart, race };
}

// A completed planned session is filed under a bare activity id, so its type
// has to come from the title Runna gave it.
function typeFromTitle(title) {
	const t = title.toLowerCase();
	if (/long run/.test(t)) return "long run";
	if (/tempo|progressive|threshold/.test(t)) return "tempo";
	if (/interval|repeat|hill|fartlek|time trial|\d+-\d+/.test(t)) return "intervals";
	if (/strength|core|lift|upper|legs|full body/.test(t)) return "strength";
	if (/\brace\b/.test(t) && !/practice/.test(t)) return "race";
	return "easy run";
}

/**
 * Planned sessions already done, from `from` up to and including `to`. Only
 * the title and date are read — the activity's own numbers are Strava's job.
 *
 * @param {ReturnType<typeof parseIcs>} events
 * @param {string} from day key
 * @param {string} to day key
 */
export function completedSessions(events, from, to) {
	return (events || [])
		.filter((e) => e.uid.startsWith("COMPLETED_PLAN_WORKOUT-") && e.date && e.date >= from && e.date <= to)
		.map((e) => sessionFrom({ ...e, description: "" }, typeFromTitle(e.summary)))
		.sort((a, b) => a.date.localeCompare(b.date));
}

const KEY_TYPES = new Set(["tempo", "intervals", "long run", "race"]);

// "400m Repeats, 7km", but "13km Hilly Long Run" already says how far.
function keyDetail(s) {
	if (!s.distanceKm || s.detail.includes(`${s.distanceKm}km`)) return s.detail;
	return `${s.detail}, ${s.distanceKm}km`;
}

/**
 * Dated sessions → the plan file's weeks: Monday `start`, `sessions` carrying
 * a weekday, and the quality sessions as `key`. `date` is dropped because
 * plan.js derives it from start + day.
 *
 * @param {object[]} sessions
 * @returns {object[]}
 */
export function toPlanWeeks(sessions) {
	const byWeek = new Map();
	for (const s of sessions) {
		const start = mondayOf(s.date);
		if (!byWeek.has(start)) byWeek.set(start, []);
		byWeek.get(start).push(s);
	}
	return [...byWeek.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([start, list]) => ({
			start,
			key: list
				.filter((s) => KEY_TYPES.has(s.type))
				.map((s) => ({ type: s.type, detail: keyDetail(s) })),
			sessions: list.map(({ date: _date, ...rest }) => rest),
		}));
}

/**
 * Fold a fresh read of the feed into what was stored last time.
 *
 * Anything after today comes from the feed alone, so a workout moved or
 * removed in Runna moves or disappears here. Today and earlier keep the
 * stored plan whenever the feed no longer lists them — a finished or skipped
 * day leaves UPCOMING, and the plan for it is history worth keeping. A day
 * never seen as upcoming (the first read, or a gap in syncing) is filled from
 * the completed planned workouts, from the block's first Monday on.
 *
 * @param {{sessions?: object[]}|null} stored
 * @param {ReturnType<typeof parseIcs>} events
 * @param {string} today day key
 * @returns {{sessions: object[], blockStart: string|null, race: object|null}}
 */
export function mergeRunnaPlan(stored, events, today) {
	const fresh = upcomingPlan(events);
	const blockStart = fresh.blockStart || stored?.blockStart || null;
	const freshDates = new Set(fresh.sessions.map((s) => s.date));
	const inBlock = (s) => !blockStart || s.date >= blockStart;

	const kept = (stored?.sessions || []).filter((s) => s.date <= today && !freshDates.has(s.date) && inBlock(s));
	const known = new Set([...freshDates, ...kept.map((s) => s.date)]);
	const backfill = blockStart
		? completedSessions(events, blockStart, today).filter((s) => !known.has(s.date))
		: [];

	const sessions = [...kept, ...backfill, ...fresh.sessions].sort((a, b) => a.date.localeCompare(b.date));
	return { sessions, blockStart, race: fresh.race || stored?.race || null };
}
