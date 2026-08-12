// Scheduled incremental sync of Strava runs into the training Blobs store.
//
// The /training page reads only from Blobs, so nothing here is in a user's
// request path and it can afford to be slow and careful.
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
import {
	SHAPE_VERSION,
	isTrackableActivity,
	isTrackableRide,
	shapeActivity,
} from "./_shared/training/shape.js";
import { loadPlan } from "./_shared/training/planFile.js";
import {
	ATHLETE_KEY,
	CURSOR_KEY,
	INDEX_KEY,
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
const QUOTA_SHARE = { shortShare: 0.6, dailyShare: 0.6 };

// Stop enriching with time to spare and write what we have. Overrunning the
// 30s limit doesn't just truncate the work — the invocation is killed before
// the Blobs write, so an unbounded run makes no progress at all and the next
// one starts from exactly the same place.
const WORK_DEADLINE_MS = 20_000;

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

	// Re-list the whole block whenever anything might need rebuilding, so
	// stale records are actually visible to the pass below. ?full=1 forces it;
	// otherwise a stale record left over from a previous invocation does. The
	// listing never reaches back past the block's run-up either way.
	const url = new URL(req.url);
	const full = url.searchParams.get("full") === "1";
	const hasStale = (existing || []).some((a) => a?.v !== SHAPE_VERSION);
	const rescan = full || hasStale;
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

	// Newest first, so a cold start fills in the most recent (most relevant)
	// weeks before working backwards through the block.
	const pending = candidates
		.filter((a) => (full ? true : isStale(String(a.id))))
		.sort((a, b) => String(b.start_date_local).localeCompare(String(a.start_date_local)));
	const needsDetail = pending.slice(0, DETAIL_BUDGET);

	// Zones only move when the athlete edits them, and every avoidable call is
	// quota the dashboard widgets can have instead. Refresh them when there's
	// enrichment to spend them on, or when we've never managed to store any.
	const storedZones = await readJson(store, ATHLETE_KEY, null);
	const zones =
		needsDetail.length > 0 || !storedZones
			? (await fetchAthleteZones(token)) || storedZones
			: storedZones;

	const deadline = Date.now() + WORK_DEADLINE_MS;
	let rateLimited = false;
	let timedOut = false;
	let quotaPaused = false;
	const fetched = await mapWithConcurrency(needsDetail, FETCH_CONCURRENCY, async (summary) => {
		if (rateLimited) return null;

		// A ride is complete as it stands. Everything the detailed activity
		// and the streams would add — splits, best efforts, grade-adjusted
		// pace, decoupling — is a running measure a ride doesn't carry, so it
		// shapes straight from the summary for no API calls at all. Tracking
		// rides therefore takes nothing from the budget the runs need.
		if (isTrackableRide(summary)) {
			return shapeActivity(summary, { thresholds, athleteZones: zones });
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
				stravaGet(`/activities/${summary.id}?include_all_efforts=true`, token),
				fetchStreams(summary.id, token),
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
			console.error(`Failed to sync activity ${summary.id}`, err);
			return null;
		}
	});
	const shaped = fetched.filter(Boolean);

	const merged = mergeActivities(existing, shaped);

	// Only advance the cursor once every candidate has an up-to-date stored
	// record — otherwise a budget-limited run would skip past the ones it
	// didn't get to and they'd never be fetched again.
	const stored = new Map(merged.map((a) => [String(a.id), a]));
	const outstanding = candidates.filter((a) => {
		const record = stored.get(String(a.id));
		return !record || record.v !== SHAPE_VERSION;
	});
	const latestEpoch = merged.length
		? Math.floor(new Date(merged.at(-1).startDateLocal).getTime() / 1000)
		: cursor?.lastActivityEpoch || null;

	await Promise.all([
		writeJson(store, INDEX_KEY, merged),
		zones ? writeJson(store, ATHLETE_KEY, zones) : Promise.resolve(),
		writeJson(store, CURSOR_KEY, {
			lastRunAt: new Date().toISOString(),
			lastActivityEpoch: outstanding.length === 0 ? latestEpoch : cursor?.lastActivityEpoch || null,
			outstanding: outstanding.length,
			// What the page needs to describe a partial history honestly.
			stored: merged.length,
		}),
	]);

	return jsonResponse({
		ok: true,
		scanned: summaries.length,
		runs: candidates.length,
		synced: shaped.length,
		stored: merged.length,
		outstanding: outstanding.length,
		shapeVersion: SHAPE_VERSION,
		rescan,
		rateLimited,
		quotaPaused,
		timedOut,
	});
}

// Every 20 minutes. Once caught up an invocation is two upstream calls (a
// token refresh and one activity listing), so the steady-state cost of this
// cadence is negligible; what it buys is the cold start. A schedule is also
// the ONLY thing that ever writes this store — a scheduled function can't be
// invoked over HTTP — so the gap between deploying and the first tick is
// exactly how long the dashboard has no runs on it at all.
export const config = {
	schedule: "*/20 * * * *",
};
