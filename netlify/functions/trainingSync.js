// Scheduled incremental sync of Strava runs into the training Blobs store.
//
// The /training page reads only from Blobs, so nothing here is in a user's
// request path and it can afford to be slow and careful. The one exception is
// a caption written back onto a new run's Strava description after the run
// has been shaped — see caption.js.
//
// Why a sync at all, rather than fetching on demand: the dashboard needs the
// whole training block with per-activity detail and streams, which is hundreds
// of upstream calls. Strava rate-limits per 15 minutes, so that can't happen
// per page load — and the streams are only needed once, since a completed run
// never changes.
//
// Backfill is handled by the same code path as the incremental case. Each
// invocation enriches a bounded number of activities and defers the rest, so a
// cold start walks backwards through the block over a few invocations instead
// of blowing the rate limit in one go.
//
// Until that backfill finishes the dashboard is showing a truncated history —
// fitness is a 42-day average, so a partial index reads as a much lower CTL
// than the athlete actually has. Two things follow from that, and both are
// load-bearing: the schedule is frequent enough that a cold start converges in
// under an hour, and the cursor's `outstanding` count is published so
// trainingData can tell the page it's still filling in rather than letting
// provisional numbers pass for final ones.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { STRAVA_API_BASE, callsRemaining, getAccessToken, readQuota } from "./_shared/strava.js";
import { getOuraAccessToken, ouraCollection } from "./_shared/oura.js";
import {
	SHAPE_VERSION,
	collectBestEfforts,
	isTrackableActivity,
	isTrackableRide,
	isTrackableStrength,
	isRunActivity,
	shapeActivity,
} from "./_shared/training/shape.js";
import { shapeNotes } from "./_shared/training/notes.js";
import { shapeRecovery } from "./_shared/training/recovery.js";
import { captionRecentRuns } from "./_shared/training/caption.js";
import { dailyLoads } from "./_shared/training/load.js";
import { fitnessSeries } from "./_shared/training/fitness.js";
import { loadPlan } from "./_shared/training/planFile.js";
import { blockRange } from "./_shared/training/plan.js";
import { addDays, toDayKey } from "./_shared/training/dates.js";
import {
	ATHLETE_KEY,
	CURSOR_KEY,
	INDEX_KEY,
	RECOVERY_KEY,
	getTrainingStore,
	mergeActivities,
	readJson,
	writeJson,
} from "./_shared/training/store.js";

const jsonResponse = createJsonResponder(cacheControl.none);

// Detail + streams is 2 upstream calls per activity, so this budget is 60
// calls per invocation. Three things bound the work and the smallest wins:
// this count, the wall-clock deadline below, and Strava's own reported quota
// (QUOTA_SHARE). A block plus its run-up is on the order of 70 runs, so a cold
// start now converges in two or three invocations rather than a working day.
const DETAIL_BUDGET = 30;
const FETCH_CONCURRENCY = 5;
const PER_PAGE = 100;
const MAX_PAGES = 4;

// The most of each Strava rate-limit window this job will spend. The same app
// credentials serve the /dashboard widgets, which are in a visitor's request
// path, so a backfill must not be able to starve them into 429s.
//
// The daily share is the one that binds. Steady state is one listing per
// invocation, which at a five-minute cadence is 288 reads a day of the 1,000
// allowed — and a SHAPE_VERSION bump adds two more per stored activity, about
// 240 for a block. At 60% those two together didn't fit, so a re-shape stalled
// halfway and waited for midnight. Three quarters fits both with room to
// spare, and still holds back 250 reads a day for widgets that are edge-cached
// for five minutes and only called on an actual visit.
const QUOTA_SHARE = { shortShare: 0.6, dailyShare: 0.75 };

// Stop enriching with time to spare and write what we have. Overrunning the
// 30s limit doesn't just truncate the work — the invocation is killed before
// the Blobs write, so an unbounded run makes no progress at all and the next
// one starts from exactly the same place.
const WORK_DEADLINE_MS = 20_000;

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
// share of 750 that the listing spends 288 of. The quota guard is what makes
// that a ceiling rather than a promise: the sweep stands down at its share
// like everything else here, so a busy day trims the fast pass rather than
// taking the window the /dashboard widgets need.
const NOTE_WINDOW_DAYS = 3;
const NOTE_RESCAN_MS = 60 * 60 * 1000;
const NOTE_FRESH_WINDOW_MS = 3 * 60 * 60 * 1000;
const NOTE_BUDGET = 5;

// Chronic training load is a 42-day average, so the block needs a run-up of
// history behind it to mean anything from day one. Four months is comfortably
// more than that without dragging in years of unrelated riding and running.
const HISTORY_LEAD_DAYS = 120;

// Epoch seconds to start listing activities from. Without a bound, the first
// sync pages through an entire Strava history and times out before writing
// anything.
function historyStartEpoch(plan) {
	const starts = (plan?.weeks || [])
		.map((w) => w?.start)
		.filter(Boolean)
		.sort();
	const anchor = starts[0] ? new Date(`${starts[0]}T00:00:00Z`) : new Date();
	if (Number.isNaN(anchor.getTime())) return null;
	return Math.floor((anchor.getTime() - HISTORY_LEAD_DAYS * 86_400_000) / 1000);
}

// The athlete's today, matching trainingData. A night is filed under the day
// you woke up in, which is a local idea rather than a UTC one.
function todayKey() {
	return toDayKey(new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }));
}

// Run an async mapper over a list a few at a time. Sequential fetches would
// spend the whole timeout waiting on round trips; unbounded parallelism would
// burst the rate limit on a cold-start backfill.
async function mapWithConcurrency(items, limit, mapper) {
	const results = [];
	let cursor = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (cursor < items.length) {
			const index = cursor++;
			results[index] = await mapper(items[index]);
		}
	});
	await Promise.all(workers);
	return results;
}

// Only the stream types the engine actually reads. `latlng` is deliberately
// absent — see _shared/training/shape.js for why the payload carries no
// coordinates, and gap.js for why GAP doesn't need them.
const STREAM_KEYS = "time,distance,heartrate,velocity_smooth,altitude,grade_smooth";

// How much sleep history to hold. Baselines are 28-day averages and the panel
// draws a month, so this is comfortably more than either needs. The whole
// window is refetched and rewritten every sync rather than merged: Oura's
// limit is 5000 requests per 5 minutes against the three this spends, and
// Oura revises a night's figures for a while after it, so the newer answer
// should win outright rather than being merged around.
const RECOVERY_DAYS = 45;

/**
 * Pull the recent nights from Oura into Blobs.
 *
 * Isolated from the Strava sync in both directions. Oura being unconfigured is
 * the normal state of a fresh checkout and mustn't read as a failure; Oura
 * being broken mustn't stop the runs syncing, which are what the page is
 * actually for. Nothing here shares a rate limit, a token or a store key with
 * the code above, so it runs alongside it rather than after it.
 *
 * @param {object} store
 * @param {string} today day key.
 * @returns {Promise<object>} a status for the response body, never a throw.
 */
async function syncRecovery(store, today) {
	let token;
	try {
		token = await getOuraAccessToken(store);
	} catch (err) {
		if (err.code === "not_configured") return { configured: false };
		console.error("Oura auth failed", err);
		return { configured: true, ok: false, reason: "auth" };
	}

	const start = addDays(today, -(RECOVERY_DAYS - 1));
	// Tomorrow, not today. Oura's date range excludes its end: asking for
	// start=end=a single day returns nothing at all, and asking through today
	// returns every night except the one people actually want to see. The
	// symptom is subtle enough to look like a working integration — the panel
	// fills in, the chart draws, and "last night" is quietly the night before.
	//
	// A plain date rather than today at 23:59:59, which also works: the
	// parameters are documented as dates, and a day past the end costs one
	// request's worth of nothing. Anything dated after today is dropped by
	// recoverySummary anyway, so a nap recorded after midnight can't turn up
	// as last night's sleep.
	const end = addDays(today, 1);
	try {
		const [sleep, dailySleep, readiness] = await Promise.all([
			ouraCollection("/v2/usercollection/sleep", token, { start, end }),
			ouraCollection("/v2/usercollection/daily_sleep", token, { start, end }),
			ouraCollection("/v2/usercollection/daily_readiness", token, { start, end }),
		]);
		const nights = shapeRecovery({ sleep, dailySleep, readiness });
		await writeJson(store, RECOVERY_KEY, nights);
		return { configured: true, ok: true, nights: nights.length };
	} catch (err) {
		// 403 is the membership having lapsed rather than anything being
		// wrong here, and it's worth being able to tell them apart in a log.
		console.error("Oura sync failed", err);
		return { configured: true, ok: false, reason: err.status === 403 ? "membership" : "fetch" };
	}
}

// Last quota Strava reported, updated on every response (including errors —
// a 429 carries the headers that say how long we've overshot by).
let quota = null;

async function stravaGet(path, token) {
	const res = await fetch(`${STRAVA_API_BASE}${path}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	quota = readQuota(res.headers) ?? quota;
	if (!res.ok) {
		const err = new Error(`Strava ${path} failed: ${res.status}`);
		err.status = res.status;
		throw err;
	}
	return res.json();
}

async function stravaPut(path, token, body) {
	const res = await fetch(`${STRAVA_API_BASE}${path}`, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	quota = readQuota(res.headers) ?? quota;
	if (!res.ok) {
		const text = await res.text();
		const err = new Error(`Strava PUT ${path} failed: ${res.status} ${text}`);
		err.status = res.status;
		err.body = text;
		throw err;
	}
	return res.json();
}

// Enough headroom left for one more activity? Two calls each. Infinity when
// Strava hasn't told us anything, in which case DETAIL_BUDGET is the only
// bound — which is what the tests and local runs see.
function hasQuotaForOneMore() {
	return callsRemaining(quota, QUOTA_SHARE) >= 2;
}

// The athlete's configured HR zones. Optional — falls back to percentages of
// max HR from the plan file when the token lacks profile:read_all.
async function fetchAthleteZones(token) {
	try {
		const zones = await stravaGet("/athlete/zones", token);
		return zones?.heart_rate?.zones || null;
	} catch {
		return null;
	}
}

// Summary activities since `after`, walking pages until they run out.
async function fetchActivitiesSince(token, afterEpoch) {
	const all = [];
	for (let page = 1; page <= MAX_PAGES; page++) {
		const query = new URLSearchParams({ per_page: String(PER_PAGE), page: String(page) });
		if (afterEpoch) query.set("after", String(afterEpoch));
		const batch = await stravaGet(`/athlete/activities?${query}`, token);
		if (!Array.isArray(batch) || batch.length === 0) break;
		all.push(...batch);
		if (batch.length < PER_PAGE) break;
	}
	return all;
}

// Streams come back keyed by type; flatten to { type: data[] }.
async function fetchStreams(id, token) {
	try {
		const raw = await stravaGet(`/activities/${id}/streams?keys=${STREAM_KEYS}&key_by_type=true`, token);
		const streams = {};
		for (const [key, value] of Object.entries(raw || {})) {
			if (Array.isArray(value?.data)) streams[key] = value.data;
		}
		return Object.keys(streams).length > 0 ? streams : null;
	} catch {
		// A run can legitimately have no streams (manual entry). Not fatal.
		return null;
	}
}

// A record a note sweep would look at at all: recent enough that a note could
// still be written on it, and a run rather than a ride, since a ride's
// description is never read for notes.
function inNoteWindow(record, today) {
	if (!isRunActivity(record)) return false;
	return toDayKey(record?.startDateLocal) >= addDays(today, -NOTE_WINDOW_DAYS);
}

/**
 * Bring the notes on the last few days' runs up to date, in place.
 *
 * Only the description is read, and only the `notes` field is written, so a
 * failure here costs the note and nothing else.
 *
 * @param {object[]} records the merged index, mutated.
 * @param {string} token
 * @param {string} today day key.
 * @param {number} deadline epoch ms to stop by.
 * @returns {Promise<number>} how many were refreshed.
 */
async function refreshNotes(records, token, today, deadline) {
	const recent = records.filter((a) => inNoteWindow(a, today)).slice(-NOTE_BUDGET);

	let refreshed = 0;
	for (const record of recent) {
		if (Date.now() > deadline || !hasQuotaForOneMore()) break;
		try {
			const detail = await stravaGet(`/activities/${record.id}`, token);
			record.notes = shapeNotes(detail?.description);
			refreshed += 1;
		} catch (err) {
			console.error(`Failed to refresh notes on ${record.id}`, err);
			if (err.status === 429) break;
		}
	}
	return refreshed;
}

export default async function handler(req) {
	// Netlify reuses warm instances, and a quota reading from a previous
	// invocation describes a window that has almost certainly rolled over
	// since. Start blind and let this run's first response say where we are.
	quota = null;

	let token;
	try {
		token = await getAccessToken();
	} catch (err) {
		if (err.code === "not_configured") return jsonResponse({ error: "not_configured" }, 503);
		console.error(err);
		return jsonResponse({ error: "auth_failed" }, 502);
	}

	const store = getTrainingStore();
	const [existing, cursor] = await Promise.all([
		readJson(store, INDEX_KEY, []),
		readJson(store, CURSOR_KEY, {}),
	]);

	const plan = loadPlan();
	const blockStart = historyStartEpoch(plan);

	// Started rather than awaited. It shares no state, token or rate limit
	// with the Strava work below, which is allowed to spend twenty seconds,
	// and there's no reason three quick requests should queue behind it.
	const recoveryWork = syncRecovery(store, todayKey());

	// The listing's job is finding activities we have never seen. That's all,
	// and it matters that it's all: paging back through the block costs three
	// reads against a limit of a thousand a day, and at a five-minute cadence
	// that's 864 a day spent before a single activity is fetched.
	//
	// A re-shape used to force exactly that, on the reasoning that stale
	// records have to be visible to the pass below. They already are — they're
	// in the stored index, with their ids — so the listing was being walked to
	// rediscover what was on disk, and a SHAPE_VERSION bump then had no quota
	// left to act on what it found. Stale records are queued from the index
	// instead, and the listing stays incremental.
	//
	// So only ?full=1 pages back, plus a cold start, which falls out of the
	// cursor being empty. The gap this leaves is an activity uploaded with a
	// date behind the cursor — a backdated manual entry — which no amount of
	// listing forward will find; ?full=1 is the answer to that too.
	const url = new URL(req.url);
	const full = url.searchParams.get("full") === "1";
	const rescan = full;
	const after = rescan ? blockStart : Math.max(cursor?.lastActivityEpoch || 0, blockStart || 0) || null;

	let summaries;
	try {
		summaries = await fetchActivitiesSince(token, after);
	} catch (err) {
		console.error("Strava activity list failed", err);
		return jsonResponse({ error: "strava_failed" }, 502);
	}

	const thresholds = plan.thresholds;

	// Private activities, other sports and short rides are dropped here, before
	// we spend any upstream budget enriching them.
	const candidates = summaries.filter(isTrackableActivity);

	// Anything we've never seen, plus anything shaped by an older version of
	// the shaping logic. Version checking is what makes a re-shape finish:
	// each batch lands at the current version and so drops out of this set,
	// where re-fetching everything on ?full=1 alone would pick the same newest
	// DETAIL_BUDGET activities on every invocation and never move past them.
	const current = new Map((existing || []).map((a) => [String(a.id), a]));
	const isStale = (id) => {
		const stored = current.get(id);
		return !stored || stored.v !== SHAPE_VERSION;
	};

	// Two sources, one queue. The listing contributes activities that aren't
	// stored; the index contributes records shaped by an older version, which
	// need no listing at all. Newest first, so a cold start fills in the most
	// recent (most relevant) weeks before working backwards through the block.
	const queued = new Set();
	const work = [];
	const enqueue = (item) => {
		if (queued.has(String(item.id))) return;
		queued.add(String(item.id));
		work.push(item);
	};
	for (const summary of candidates) {
		if (!full && !isStale(String(summary.id))) continue;
		enqueue({
			id: summary.id,
			summary,
			skipStreams: isTrackableRide(summary) || isTrackableStrength(summary),
			date: summary.start_date_local,
		});
	}
	for (const record of existing || []) {
		if (!full && record?.v === SHAPE_VERSION) continue;
		enqueue({
			id: record?.id,
			summary: null,
			skipStreams: !isRunActivity(record),
			date: record?.startDateLocal,
		});
	}
	work.sort((a, b) => String(b.date).localeCompare(String(a.date)));
	const needsDetail = work.slice(0, DETAIL_BUDGET);

	// Fetched once and then kept. Zones only move when the athlete edits them,
	// and since they're now the third choice behind a measured threshold (see
	// zones.js) they usually aren't read at all — so re-reading them on every
	// invocation of a backfill was a call a minute spent on a value that
	// mostly doesn't apply. ?full=1 picks up an edit.
	const storedZones = await readJson(store, ATHLETE_KEY, null);
	const zones = (storedZones && !full ? null : await fetchAthleteZones(token)) || storedZones;

	const deadline = Date.now() + WORK_DEADLINE_MS;
	let rateLimited = false;
	let timedOut = false;
	let quotaPaused = false;
	const fetched = await mapWithConcurrency(needsDetail, FETCH_CONCURRENCY, async (item) => {
		if (rateLimited) return null;

		// A ride is complete as it stands. Everything the detailed activity
		// and the streams would add — splits, best efforts, grade-adjusted
		// pace, decoupling — is a running measure a ride doesn't carry, so it
		// shapes straight from the summary for no API calls at all. Tracking
		// rides therefore takes nothing from the budget the runs need.
		// A ride or gym session is complete as it stands. Everything the
		// detailed activity and the streams would add is a running measure
		// those sports don't carry, so they shape straight from the summary.
		if (item.skipStreams && item.summary) {
			return shapeActivity(item.summary, { thresholds, athleteZones: zones });
		}

		if (Date.now() > deadline) {
			timedOut = true;
			return null;
		}
		// Stop before Strava has to say no: a 429 costs a call and, if we kept
		// going, would eat into the window the /dashboard widgets need.
		if (!hasQuotaForOneMore()) {
			quotaPaused = true;
			return null;
		}
		try {
			const [detail, streams] = await Promise.all([
				stravaGet(`/activities/${item.id}?include_all_efforts=true`, token),
				// A ride queued off the index has no summary to shape from, so
				// it costs the detail — but still not the streams, which it
				// would carry no number derived from.
				item.skipStreams ? null : fetchStreams(item.id, token),
			]);
			return shapeActivity(detail, { streams, thresholds, athleteZones: zones });
		} catch (err) {
			// Once Strava starts refusing, stop asking — the remaining
			// activities will be picked up by the next scheduled run.
			if (err.status === 429) {
				rateLimited = true;
				console.warn("Strava rate limit hit; deferring the rest to the next run");
				return null;
			}
			console.error(`Failed to sync activity ${item.id}`, err);
			return null;
		}
	});
	const shaped = fetched.filter(Boolean);

	const merged = mergeActivities(existing, shaped);

	// Deliberately last, and deliberately not part of the staleness pass
	// above: nothing here can make a record pending, so a sweep that runs out
	// of budget just leaves a note until the next pass. Skipped entirely while
	// there's backfill outstanding, which is when the calls are worth more
	// spent on runs that have no numbers at all yet.
	const today = todayKey();

	// When a run last turned up that a note could be written on. Wall-clock
	// arrival rather than the run's own start time, because what starts the
	// clock is the activity reaching the page — an upload hours after a race,
	// or a watch that only syncs when it finds wifi, is still a run the
	// athlete is looking at now.
	//
	// Gated on the record being one the sweep would read anyway, which is what
	// keeps a cold start from spending three hours sweeping every five minutes
	// on the strength of a four-month backfill of run-up history.
	const arrived = shaped.some((a) => !current.has(String(a.id)) && inNoteWindow(a, today));
	const arrivedAt = arrived ? new Date().toISOString() : cursor?.activityArrivedAt || null;
	const fresh = Date.now() - (Date.parse(arrivedAt || "") || 0) < NOTE_FRESH_WINDOW_MS;

	const lastNoteScan = Date.parse(cursor?.notesScannedAt || "") || 0;
	// Zero is every invocation, which is the schedule's five minutes.
	const noteInterval = fresh ? 0 : NOTE_RESCAN_MS;
	const scanNotes = !rateLimited && work.length === 0 && Date.now() - lastNoteScan >= noteInterval;
	const notesRefreshed = scanNotes ? await refreshNotes(merged, token, today, deadline) : 0;

	// The one write. A new run that has numbers gets a fenced block on its
	// Strava description; a later pass sees the stamp (or the fence) and
	// leaves it. Skipped when the read path already stood down, so a caption
	// never spends the window the widgets need.
	let captioned = 0;
	let captionUrlRejected = false;
	if (!rateLimited && !quotaPaused && work.length === 0) {
		const runs = merged.filter(isRunActivity);
		const range = blockRange(plan, runs, today);
		const series = range ? fitnessSeries(dailyLoads(runs), range) : [];
		const result = await captionRecentRuns({
			records: merged,
			today,
			series,
			efforts: collectBestEfforts(runs),
			raceDistanceM: plan.race?.distanceM || 42195,
			deadline,
			getDescription: async (id) => {
				if (!hasQuotaForOneMore()) {
					const err = new Error("quota");
					err.status = 429;
					throw err;
				}
				const detail = await stravaGet(`/activities/${id}`, token);
				return detail?.description ?? "";
			},
			putDescription: async (id, description) => {
				await stravaPut(`/activities/${id}`, token, { description });
			},
		});
		captioned = result.captioned;
		captionUrlRejected = result.urlRejected;
	}

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
	const stored = new Map(merged.map((a) => [String(a.id), a]));
	const missing = candidates.filter((a) => !stored.has(String(a.id))).length;
	const stale = merged.filter((a) => a?.v !== SHAPE_VERSION).length;

	// The cursor guards the listing and nothing else, so it may advance as
	// soon as every activity the listing found is stored. A record still
	// waiting to be re-shaped no longer holds it back: that one is queued from
	// the index now, and listing it again wouldn't help.
	const allListedStored = candidates.every((a) => stored.has(String(a.id)));
	const latestEpoch = merged.length
		? Math.floor(new Date(merged.at(-1).startDateLocal).getTime() / 1000)
		: cursor?.lastActivityEpoch || null;

	await Promise.all([
		writeJson(store, INDEX_KEY, merged),
		zones ? writeJson(store, ATHLETE_KEY, zones) : Promise.resolve(),
		writeJson(store, CURSOR_KEY, {
			lastRunAt: new Date().toISOString(),
			// Stamped on the attempt rather than on a success, so a sweep that
			// finds nothing to do waits out its interval instead of being
			// retried on the next invocation — which, outside the fast window,
			// is the difference between hourly and every five minutes.
			notesScannedAt: scanNotes ? new Date().toISOString() : cursor?.notesScannedAt || null,
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
		}),
	]);

	return jsonResponse({
		ok: true,
		scanned: summaries.length,
		runs: candidates.length,
		synced: shaped.length,
		notesRefreshed,
		// Whether the sweep is on the five-minute cadence or the hourly one,
		// which is otherwise only visible as a read count in Strava's quota.
		notesFresh: fresh,
		captioned,
		captionUrlRejected,
		stored: merged.length,
		missing,
		stale,
		shapeVersion: SHAPE_VERSION,
		rescan,
		rateLimited,
		quotaPaused,
		timedOut,
		recovery: await recoveryWork,
	});
}

// Every 5 minutes, which is what a run showing up on the page shortly after it
// uploads costs. Paired with a 60s edge cache on trainingData, so the cadence
// is the whole delay rather than half of it.
//
// Once caught up an invocation is two upstream calls: a token refresh and one
// activity listing — plus, on the pass that sweeps notes, a call per run in
// that sweep. Strava meters those in two buckets and the tighter one is
// reads — 100 per 15 minutes and 1,000 per day at the standard tier — but only
// the listing is a read, since the refresh is a POST to /oauth/token. So this
// cadence spends about 288 reads a day of 1,000, and three of the 100 in any
// quarter hour. The same app credentials serve the /dashboard widgets in a
// visitor's request path, which is the reason for the headroom and for
// QUOTA_SHARE above.
//
// Backfill is the expensive case, at up to DETAIL_BUDGET × 2 reads an
// invocation — more than a quarter hour's whole share in one go. That is fine,
// and it's why the quota guard exists: it reads Strava's own headers and
// stands the job down at its share of either bucket, so a cold start moves at
// whatever the window allows and defers the rest. Shortening the interval
// therefore doesn't buy a faster backfill and can't buy a 429 either; both are
// the guard's business. What it buys is the steady state.
//
// The thing that has to stay true for any of that to hold is that a backfill
// costs the same *per activity* however often this runs. It didn't, once: a
// re-shape re-listed the whole block every invocation, so shortening the
// interval multiplied a fixed 3-read overhead by 288 a day and left nothing to
// enrich with. See the listing comment in the handler. Per-invocation overhead
// is the number to watch here, not per-activity cost.
//
// A schedule is also the ONLY thing that ever writes this store — a scheduled
// function can't be invoked over HTTP — so the gap between deploying and the
// first tick is exactly how long the dashboard has no runs on it at all.
export const config = {
	schedule: "*/5 * * * *",
};
