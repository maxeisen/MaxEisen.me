// What the Strava sync should do on one tick, as pure functions of what it
// knows: the stored index, the cursor, the listing and the clock.
//
// trainingSync does the I/O; every decision about what to list, what to
// enrich, when to sweep notes, when to caption and how far the cursor may
// advance is made here, so the properties the sync rests on (a re-shape
// finishes, the cursor never skips an activity it hasn't stored, a backfill
// isn't reported as a reshape) can be tested with plain data.

import {
	SHAPE_VERSION,
	isRunActivity,
	isTrackableActivity,
	isTrackableRide,
	isTrackableStrength,
} from "./shape.js";
import { addDays, toDayKey } from "./dates.js";

// Detail + streams is 2 upstream calls per activity, so this budget is 60
// calls per invocation. Three things bound the work and the smallest wins:
// this count, the handler's wall-clock deadline, and Strava's own reported
// quota (the client's share). A block plus its run-up is on the order of 70
// runs, so a cold start converges in two or three invocations rather than a
// working day.
export const DETAIL_BUDGET = 30;

// Chronic training load is a 42-day average, so the block needs a run-up of
// history behind it to mean anything from day one. Four months is comfortably
// more than that without dragging in years of unrelated riding and running.
export const HISTORY_LEAD_DAYS = 120;

// A finished run never changes, which is the assumption the whole sync rests
// on — but its description does. The note explaining why a long run was cut
// short is usually written hours later, with the evening's hindsight, long
// after the record was shaped and settled.
//
// Rather than making a settled record pending again (which would re-fetch the
// streams to recompute numbers that cannot have moved), the last few days are
// swept for the description alone: one call each, and only the notes are
// patched across. Three days because a note that hasn't been written by then
// isn't coming.
//
// How long the sweep waits between passes is the whole delay on seeing a note,
// and the odds of there being one to see are not flat over those three days.
// They spike right after a run lands: the note is usually typed in the same
// sitting as the upload, or in the hour or two after it while the run is still
// the thing being looked at. So for the first few hours after an activity
// first appears the sweep runs on every invocation — the same five minutes the
// activity itself took to show up, so a note written beside it isn't waiting
// an hour behind a run the page already has. After that the odds flatten out
// and it falls back to hourly, which is what a note remembered the next
// morning is worth.
//
// The fast pass is bounded by an activity arriving rather than by a clock, so
// the steady state is still the hourly one: a week with no runs in it costs
// exactly what it did before. A day with a run in it costs the three hours
// after it — 36 invocations of at most NOTE_BUDGET reads each, against a daily
// share of 750 that the listing spends 288 of. The client's share is what
// makes that a ceiling rather than a promise: the sweep stands down at its
// share like everything else, so a busy day trims the fast pass rather than
// taking the window the /dashboard widgets need.
export const NOTE_WINDOW_DAYS = 3;
export const NOTE_RESCAN_MS = 60 * 60 * 1000;
export const NOTE_FRESH_WINDOW_MS = 3 * 60 * 60 * 1000;
export const NOTE_BUDGET = 5;

/**
 * Epoch seconds to start listing activities from. Without a bound, the first
 * sync pages through an entire Strava history and times out before writing
 * anything.
 *
 * @param {object} plan the combined plan.
 * @returns {number|null}
 */
export function historyStartEpoch(plan) {
	const starts = (plan?.weeks || [])
		.map((w) => w?.start)
		.filter(Boolean)
		.sort();
	const anchor = starts[0] ? new Date(`${starts[0]}T00:00:00Z`) : new Date();
	if (Number.isNaN(anchor.getTime())) return null;
	return Math.floor((anchor.getTime() - HISTORY_LEAD_DAYS * 86_400_000) / 1000);
}

/**
 * Where this tick's listing starts.
 *
 * The listing's job is finding activities we have never seen. That's all,
 * and it matters that it's all: paging back through the block costs three
 * reads against a limit of a thousand a day, and at a five-minute cadence
 * that's 864 a day spent before a single activity is fetched.
 *
 * A re-shape used to force exactly that, on the reasoning that stale records
 * have to be visible to the enrichment pass. They already are — they're in the
 * stored index, with their ids — so the listing was being walked to
 * rediscover what was on disk, and a SHAPE_VERSION bump then had no quota left
 * to act on what it found. Stale records are queued from the index instead
 * (see queueWork), and the listing stays incremental.
 *
 * So only ?full=1 pages back, plus a cold start, which falls out of the
 * cursor being empty. The gap this leaves is an activity uploaded with a date
 * behind the cursor — a backdated manual entry — which no amount of listing
 * forward will find; ?full=1 is the answer to that too.
 *
 * @param {{cursor?: object, plan: object, full?: boolean}} input
 * @returns {number|null} epoch seconds, or null for no lower bound.
 */
export function listingAfter({ cursor, plan, full = false }) {
	const blockStart = historyStartEpoch(plan);
	if (full) return blockStart;
	return Math.max(cursor?.lastActivityEpoch || 0, blockStart || 0) || null;
}

function kindOfSummary(summary) {
	return isTrackableStrength(summary) ? "strength" : isTrackableRide(summary) ? "ride" : "run";
}

function kindOfRecord(record) {
	return record?.sport === "ride" ? "ride" : record?.sport === "strength" ? "strength" : "run";
}

/**
 * What to enrich this tick.
 *
 * Anything we've never seen, plus anything shaped by an older version of the
 * shaping logic. Version checking is what makes a re-shape finish: each batch
 * lands at the current version and so drops out of this set, where
 * re-fetching everything on ?full=1 alone would pick the same newest
 * DETAIL_BUDGET activities on every invocation and never move past them.
 *
 * Two sources, one queue. The listing contributes activities that aren't
 * stored; the index contributes records shaped by an older version, which need
 * no listing at all. Newest first, so a cold start fills in the most recent
 * (most relevant) weeks before working backwards through the block.
 *
 * @param {object} input
 * @param {object[]} input.summaries this tick's Strava listing.
 * @param {object[]} input.existing the stored index.
 * @param {boolean} [input.full] ?full=1: re-enrich everything listed and stored.
 * @param {number} [input.budget]
 * @returns {{candidates: object[], queue: object[], enrich: object[]}}
 *   candidates are the listed activities worth storing at all (private
 *   activities, other sports and short rides are dropped before any upstream
 *   budget is spent on them); queue is everything outstanding, newest first;
 *   enrich is the part of it this tick takes on.
 */
export function queueWork({ summaries = [], existing = [], full = false, budget = DETAIL_BUDGET }) {
	const candidates = summaries.filter(isTrackableActivity);
	const stored = new Map((existing || []).map((a) => [String(a.id), a]));
	const isStale = (id) => stored.get(String(id))?.v !== SHAPE_VERSION;

	const queued = new Set();
	const queue = [];
	const enqueue = (item) => {
		if (queued.has(String(item.id))) return;
		queued.add(String(item.id));
		queue.push(item);
	};
	for (const summary of candidates) {
		if (!full && !isStale(summary.id)) continue;
		enqueue({ id: summary.id, summary, kind: kindOfSummary(summary), date: summary.start_date_local });
	}
	for (const record of existing || []) {
		if (!full && record?.v === SHAPE_VERSION) continue;
		enqueue({ id: record?.id, summary: null, kind: kindOfRecord(record), date: record?.startDateLocal });
	}
	queue.sort((a, b) => String(b.date).localeCompare(String(a.date)));
	return { candidates, queue, enrich: queue.slice(0, budget) };
}

/**
 * A record a note sweep would look at at all: recent enough that a note could
 * still be written on it, and a run rather than a ride, since a ride's
 * description is never read for notes.
 *
 * @param {object} record
 * @param {string} today day key.
 * @returns {boolean}
 */
export function inNoteWindow(record, today) {
	if (!isRunActivity(record)) return false;
	return toDayKey(record?.startDateLocal) >= addDays(today, -NOTE_WINDOW_DAYS);
}

/**
 * The records a note sweep reads, newest last.
 *
 * @param {object[]} records the merged index, oldest first.
 * @param {string} today
 * @returns {object[]}
 */
export function noteSweepTargets(records, today) {
	return (records || []).filter((a) => inNoteWindow(a, today)).slice(-NOTE_BUDGET);
}

/**
 * Everything the tick decides once enrichment is over: whether to sweep notes,
 * whether to caption, and the cursor to write.
 *
 * @param {object} input
 * @param {object} [input.cursor] the cursor this tick started from.
 * @param {object[]} input.existing the index this tick started from.
 * @param {object[]} input.candidates from queueWork.
 * @param {number} input.queued how much queueWork found outstanding.
 * @param {object[]} input.shaped what enrichment produced.
 * @param {object[]} input.merged the index about to be written, oldest first.
 * @param {boolean} input.rateLimited Strava refused a call this tick.
 * @param {boolean} input.quotaPaused the job stood down at its share.
 * @param {string} input.today day key.
 * @param {number} [input.now] epoch ms.
 * @returns {{sweepNotes: boolean, notesFresh: boolean, caption: boolean,
 *   missing: number, stale: number, cursor: object}} the cursor leaves out
 *   rateLimitedUntil, which only the Strava client knows, and only once the
 *   tick's last call has been made.
 */
export function settleSync({
	cursor = {},
	existing = [],
	candidates = [],
	queued = 0,
	shaped = [],
	merged = [],
	rateLimited = false,
	quotaPaused = false,
	today,
	now = Date.now(),
}) {
	const nowIso = new Date(now).toISOString();
	const before = new Set((existing || []).map((a) => String(a.id)));
	// Notes and captions wait for the backfill: while there's anything left to
	// enrich, the calls are worth more spent on runs that have no numbers yet.
	const caughtUp = queued === 0;

	// When a run last turned up that a note could be written on. Wall-clock
	// arrival rather than the run's own start time, because what starts the
	// clock is the activity reaching the page — an upload hours after a race,
	// or a watch that only syncs when it finds wifi, is still a run the
	// athlete is looking at now.
	//
	// Gated on the record being one the sweep would read anyway, which is what
	// keeps a cold start from spending three hours sweeping every five minutes
	// on the strength of a four-month backfill of run-up history.
	const arrived = shaped.some((a) => !before.has(String(a.id)) && inNoteWindow(a, today));
	const arrivedAt = arrived ? nowIso : cursor?.activityArrivedAt || null;
	const notesFresh = now - (Date.parse(arrivedAt || "") || 0) < NOTE_FRESH_WINDOW_MS;

	const lastNoteScan = Date.parse(cursor?.notesScannedAt || "") || 0;
	// Zero is every invocation, which is the schedule's five minutes.
	const noteInterval = notesFresh ? 0 : NOTE_RESCAN_MS;
	const sweepNotes = !rateLimited && caughtUp && now - lastNoteScan >= noteInterval;

	// The one write to Strava. Skipped whenever the read path stood down, so a
	// caption never spends the window the widgets need.
	const caption = !rateLimited && !quotaPaused && caughtUp;

	// Two kinds of incomplete, and only one of them is worth interrupting a
	// reader over.
	//
	// Missing is an activity the listing found and there's no record of at
	// all. Every metric on the page reads the whole block — fitness is a
	// 42-day average, the projection reads the block's best efforts — so a
	// short history doesn't render slightly-off numbers, it renders numbers
	// for a block the athlete didn't do. That has to be said out loud.
	//
	// Stale is an activity that's stored and complete and merely shaped by an
	// older version of the code. Re-shaping moves some of its numbers and
	// changes nothing else about it. Counted together with missing, as they
	// were, every SHAPE_VERSION bump hung a "still importing" banner on a page
	// that was already whole — and since the queue runs newest-first, the
	// stragglers are the oldest run-up records, which exist only to seed a CTL
	// four months before anything on the page and are the least visible
	// records in the store.
	const stored = new Set(merged.map((a) => String(a.id)));
	const missing = candidates.filter((a) => !stored.has(String(a.id))).length;
	const stale = merged.filter((a) => a?.v !== SHAPE_VERSION).length;

	// The cursor guards the listing and nothing else, so it may advance as
	// soon as every activity the listing found is stored. A record still
	// waiting to be re-shaped no longer holds it back: that one is queued from
	// the index now, and listing it again wouldn't help.
	const allListedStored = missing === 0;
	const latestEpoch = merged.length
		? Math.floor(new Date(merged.at(-1).startDateLocal).getTime() / 1000)
		: cursor?.lastActivityEpoch || null;

	return {
		sweepNotes,
		notesFresh,
		caption,
		missing,
		stale,
		cursor: {
			lastRunAt: nowIso,
			// Stamped on the attempt rather than on a success, so a sweep that
			// finds nothing to do waits out its interval instead of being
			// retried on the next invocation — which, outside the fast window,
			// is the difference between hourly and every five minutes.
			notesScannedAt: sweepNotes ? nowIso : cursor?.notesScannedAt || null,
			// What the fast window is measured from, and why it survives the
			// invocation that opened it: the run that starts the clock arrives
			// on a pass that has backfill outstanding and so doesn't sweep.
			activityArrivedAt: arrivedAt,
			lastActivityEpoch: allListedStored ? latestEpoch : cursor?.lastActivityEpoch || null,
			// What the page needs to describe a partial history honestly. Only
			// `missing` reaches a reader; `stale` is here to be read in a log
			// when a re-shape looks like it has stopped.
			missing,
			stale,
			stored: merged.length,
		},
	};
}
