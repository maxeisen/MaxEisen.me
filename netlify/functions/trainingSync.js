// Scheduled incremental sync of Strava runs into the training Blobs store.
//
// The /running page reads only from Blobs, so nothing here is in a user's
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
//
// The decisions — what to list, what to enrich, when to sweep notes, when to
// caption, how far the cursor moves — are in _shared/training/syncPlan.js. The
// rate limit is the Strava client's (_shared/strava.js). This file is the
// sequence and the I/O.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { getEnv } from "./_shared/env.js";
import { openStravaClient } from "./_shared/strava.js";
import { getOuraAccessToken, ouraCollection } from "./_shared/oura.js";
import {
	SHAPE_VERSION,
	collectBestEfforts,
	isRunActivity,
	shapeActivity,
} from "./_shared/training/shape.js";
import { shapeNotes } from "./_shared/training/notes.js";
import { shapeRecovery } from "./_shared/training/recovery.js";
import { captionRecentRuns } from "./_shared/training/caption.js";
import { dailyLoads } from "./_shared/training/load.js";
import { fitnessSeries } from "./_shared/training/fitness.js";
import { combinePlans, loadPlan } from "./_shared/training/planFile.js";
import { mergeRunnaPlan, parseIcs } from "./_shared/training/runna.js";
import { blockRange } from "./_shared/training/plan.js";
import { addDays, torontoToday } from "./_shared/training/dates.js";
import {
	listingAfter,
	noteSweepTargets,
	queueWork,
	settleSync,
} from "./_shared/training/syncPlan.js";
import {
	ATHLETE_KEY,
	CURSOR_KEY,
	INDEX_KEY,
	PUBLIC_KEY,
	RECOVERY_KEY,
	RUNNA_PLAN_KEY,
	getTrainingStore,
	mergeActivities,
	readJson,
	writeJson,
} from "./_shared/training/store.js";
import { FEED_CAP, mergeFeed, passesFeedFilter, shapeFeedItem, shapeYtdTotals, STRAVA_ATHLETE_ID } from "./_shared/stravaPublic.js";
import { mostRecentGearId, shapeGear } from "./_shared/stravaGear.js";
import { mapWithConcurrency } from "../../src/lib/data/concurrent.js";

const jsonResponse = createJsonResponder(cacheControl.none);

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

// Only the stream types the engine actually reads. `latlng` is deliberately
// absent — see _shared/training/shape.js for why the payload carries no
// coordinates, and gap.js for why GAP doesn't need them.
const STREAM_KEYS = "time,distance,heartrate,velocity_smooth,altitude,grade_smooth";
// Distance places the chart. Watts come back for every ride; shape.js keeps
// them only when device_watts is set. One request, not a second call.
const RIDE_STREAM_KEYS = "time,distance,heartrate,watts";

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

// How often the Runna feed is re-read. Moving a workout in the app should show
// up on the page about as fast as a run does, and one small GET every quarter
// hour is nothing to Runna — but there's no reason to make it every tick.
const RUNNA_REFRESH_MS = 15 * 60 * 1000;
const RUNNA_TIMEOUT_MS = 8_000;

/**
 * Re-read the plan from Runna's calendar feed into Blobs.
 *
 * Isolated the same way as syncRecovery: no feed configured is a normal
 * state (the plan file alone), and a broken feed keeps the last good plan
 * rather than blanking the block. A feed that parses to no sessions at all is
 * treated as broken, not as a plan with nothing in it.
 *
 * @param {object} store
 * @param {object|null} stored the last runna-plan.json
 * @param {string} today day key.
 * @returns {Promise<object>} a status for the response body, never a throw.
 */
async function syncRunnaPlan(store, stored, today) {
	const url = (getEnv("RUNNA_ICS_URL") || "").trim();
	if (!url) return { configured: false };
	if (!/^https:\/\//i.test(url)) return { configured: true, ok: false, reason: "bad_url" };

	const last = Date.parse(stored?.fetchedAt || "") || 0;
	if (Date.now() - last < RUNNA_REFRESH_MS) return { configured: true, ok: true, fresh: false };

	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(RUNNA_TIMEOUT_MS) });
		if (!res.ok) {
			// The status only — the URL is the credential and must not be logged.
			console.error("Runna feed failed", res.status);
			return { configured: true, ok: false, reason: "fetch" };
		}
		const plan = mergeRunnaPlan(stored, parseIcs(await res.text()), today);
		if (plan.sessions.length === 0) return { configured: true, ok: false, reason: "empty" };
		await writeJson(store, RUNNA_PLAN_KEY, { ...plan, fetchedAt: new Date().toISOString() });
		return { configured: true, ok: true, fresh: true, sessions: plan.sessions.length };
	} catch (err) {
		console.error("Runna feed failed", err?.name || "error");
		return { configured: true, ok: false, reason: "fetch" };
	}
}

// An activity needs two calls (detail + streams), so that's what a step that
// starts one has to see left.
const CALLS_PER_ACTIVITY = 2;

// The athlete's configured HR zones. Optional — falls back to percentages of
// max HR from the plan file when the token lacks profile:read_all.
async function fetchAthleteZones(strava) {
	try {
		const zones = await strava.get("/athlete/zones");
		return zones?.heart_rate?.zones || null;
	} catch {
		return null;
	}
}

// Summary activities since `after`, walking pages until they run out.
async function fetchActivitiesSince(strava, afterEpoch) {
	const all = [];
	for (let page = 1; page <= MAX_PAGES; page++) {
		const query = new URLSearchParams({ per_page: String(PER_PAGE), page: String(page) });
		if (afterEpoch) query.set("after", String(afterEpoch));
		const batch = await strava.get(`/athlete/activities?${query}`);
		if (!Array.isArray(batch) || batch.length === 0) break;
		all.push(...batch);
		if (batch.length < PER_PAGE) break;
	}
	return all;
}

// Streams come back keyed by type; flatten to { type: data[] }.
async function fetchStreams(strava, id, keys = STREAM_KEYS) {
	try {
		const raw = await strava.get(`/activities/${id}/streams?keys=${keys}&key_by_type=true`);
		const streams = {};
		for (const [key, value] of Object.entries(raw || {})) {
			if (Array.isArray(value?.data)) streams[key] = value.data;
		}
		return Object.keys(streams).length > 0 ? streams : null;
	} catch (err) {
		// A run can legitimately have no streams (manual entry). A 429 is not
		// that — swallowing it would keep the rest of the batch asking.
		if (err.status === 429) throw err;
		return null;
	}
}

/**
 * Shape what the queue gave this tick, as far as the deadline and the share
 * allow. Whatever isn't reached stays queued: the next tick finds it again.
 *
 * @param {object[]} items from queueWork's `enrich`.
 * @param {object} ctx
 * @returns {Promise<{shaped: object[], rateLimited: boolean, quotaPaused: boolean, timedOut: boolean}>}
 */
async function enrich(items, { strava, thresholds, zones, deadline }) {
	const outcome = { rateLimited: strava.coolingDown(), quotaPaused: false, timedOut: false };
	const options = { thresholds, athleteZones: zones };

	const fetched = await mapWithConcurrency(items, FETCH_CONCURRENCY, async (item) => {
		if (outcome.rateLimited) return null;

		// A gym session has no stream-derived number. Shape it from the summary
		// when we have one, and spend a detail call only when we don't.
		if (item.kind === "strength" && item.summary) return shapeActivity(item.summary, options);

		if (Date.now() > deadline) {
			outcome.timedOut = true;
			return null;
		}
		if (strava.coolingDown()) {
			outcome.rateLimited = true;
			return null;
		}
		// Stop before Strava has to say no: a 429 costs a call and, if we kept
		// going, would eat into the window the /dashboard widgets need.
		if (!strava.canSpend(CALLS_PER_ACTIVITY)) {
			outcome.quotaPaused = true;
			return null;
		}

		// A listed ride already carries meter watts. One stream call covers
		// zone time and the last-ride chart. No location or grade.
		const listedRide = item.kind === "ride" && item.summary;
		try {
			if (listedRide) {
				const streams = await fetchStreams(strava, item.id, RIDE_STREAM_KEYS);
				return shapeActivity(item.summary, { ...options, streams });
			}
			const [detail, streams] = await Promise.all([
				strava.get(`/activities/${item.id}?include_all_efforts=true`),
				// A stale ride has no summary on the queue, so it pays for the
				// detail. Its streams are still the ride set. Strength pays for
				// the detail and nothing else.
				item.kind === "ride"
					? fetchStreams(strava, item.id, RIDE_STREAM_KEYS)
					: item.kind === "strength"
						? null
						: fetchStreams(strava, item.id),
			]);
			return shapeActivity(detail, { ...options, streams });
		} catch (err) {
			// Once Strava starts refusing, stop asking — the remaining
			// activities will be picked up by the next scheduled run.
			if (err.status === 429) {
				if (err.overShare) {
					outcome.quotaPaused = true;
				} else {
					outcome.rateLimited = true;
					console.warn("Strava rate limit hit; deferring the rest to the next run");
				}
				return null;
			}
			console.error(`Failed to sync activity ${item.id}`, err);
			return listedRide ? shapeActivity(item.summary, options) : null;
		}
	});
	return { shaped: fetched.filter(Boolean), ...outcome };
}

/**
 * Bring the notes on the last few days' runs up to date, in place.
 *
 * Only the description is read, and only the `notes` field is written, so a
 * failure here costs the note and nothing else.
 *
 * @param {object[]} records the merged index, mutated.
 * @returns {Promise<number>} how many were refreshed.
 */
async function refreshNotes(records, strava, today, deadline) {
	let refreshed = 0;
	for (const record of noteSweepTargets(records, today)) {
		if (Date.now() > deadline || !strava.canSpend(CALLS_PER_ACTIVITY)) break;
		try {
			const detail = await strava.get(`/activities/${record.id}`);
			record.notes = shapeNotes(detail?.description);
			refreshed += 1;
		} catch (err) {
			if (err.status === 429) break;
			console.error(`Failed to refresh notes on ${record.id}`, err);
		}
	}
	return refreshed;
}

/** Caption the newest runs that have numbers and no caption yet. */
function caption(merged, plan, today, strava, deadline) {
	const runs = merged.filter(isRunActivity);
	const range = blockRange(plan, runs, today);
	const series = range ? fitnessSeries(dailyLoads(runs), range) : [];
	return captionRecentRuns({
		records: merged,
		today,
		series,
		efforts: collectBestEfforts(runs),
		runs,
		raceDistanceM: plan.race?.distanceM || 42195,
		deadline,
		getDescription: async (id) => {
			// The read is only worth spending if the write can follow it.
			strava.reserve(CALLS_PER_ACTIVITY);
			const detail = await strava.get(`/activities/${id}`);
			return detail?.description ?? "";
		},
		putDescription: (id, description) => strava.put(`/activities/${id}`, { description }),
	});
}

async function fetchPublicGear(strava, id) {
	if (!id) return null;
	try {
		return shapeGear(await strava.get(`/gear/${id}`));
	} catch (err) {
		if (err.status === 429) throw err;
		console.error("Strava gear failed:", id, err);
		return null;
	}
}

function feedDropIds(list, existingActs) {
	const stored = new Set((existingActs || []).map((a) => String(a.id)));
	return (list || [])
		.filter((a) => a?.id != null && stored.has(String(a.id)) && !passesFeedFilter(a))
		.map((a) => a.id);
}

/**
 * Homepage / dashboard / toronto snapshot. Built from the listing this tick
 * already made, plus one extra latest-page fetch when the blob is empty and
 * the incremental listing had nothing to offer (a caught-up cursor on first
 * deploy of this snapshot). Stats and gear only move when a new activity
 * (or a new gear id) shows up. A listing that marks a stored activity private
 * still writes, even on an otherwise quiet tick, so the polyline does not
 * linger on the public surfaces.
 */
async function updatePublicSnapshot(store, strava, snapshot, summaries) {
	const existingActs = snapshot?.activities || [];
	let incoming = (summaries || []).filter(passesFeedFilter).map(shapeFeedItem).filter(Boolean);
	let dropIds = feedDropIds(summaries, existingActs);
	const rawForGear = [...(summaries || [])];

	if (existingActs.length === 0 && incoming.length === 0) {
		try {
			const latest = await strava.get(`/athlete/activities?per_page=${PER_PAGE}&page=1`);
			if (Array.isArray(latest)) {
				rawForGear.push(...latest);
				incoming = latest.filter(passesFeedFilter).map(shapeFeedItem).filter(Boolean);
				dropIds = dropIds.concat(feedDropIds(latest, existingActs));
			}
		} catch (err) {
			if (err.status === 429) throw err;
			console.error("public snapshot seed failed", err);
		}
	}

	const existingIds = new Set(existingActs.map((a) => String(a.id)));
	const hasNew = incoming.some((a) => !existingIds.has(String(a.id)));
	const rideGear = mostRecentGearId(rawForGear, "ride");
	const runGear = mostRecentGearId(rawForGear, "run");
	const gearChanged =
		(rideGear && rideGear !== snapshot?.bike?.id) || (runGear && runGear !== snapshot?.shoes?.id);
	const needProfile = !snapshot?.ytd || hasNew || gearChanged;

	if (incoming.length === 0 && !needProfile && dropIds.length === 0) return snapshot;

	const activities = mergeFeed(existingActs, incoming, FEED_CAP, { dropIds });
	let bike = snapshot?.bike ?? null;
	let shoes = snapshot?.shoes ?? null;
	let ytd = snapshot?.ytd ?? { run: null, ride: null };

	if (needProfile) {
		const stats = await strava.get(`/athletes/${STRAVA_ATHLETE_ID}/stats`);
		ytd = {
			run: shapeYtdTotals(stats?.ytd_run_totals),
			ride: shapeYtdTotals(stats?.ytd_ride_totals),
		};
		const bikeId = rideGear || snapshot?.bike?.id;
		const shoesId = runGear || snapshot?.shoes?.id;
		const [nextBike, nextShoes] = await Promise.all([
			bikeId && bikeId !== snapshot?.bike?.id
				? fetchPublicGear(strava, bikeId)
				: Promise.resolve(snapshot?.bike ?? null),
			shoesId && shoesId !== snapshot?.shoes?.id
				? fetchPublicGear(strava, shoesId)
				: Promise.resolve(snapshot?.shoes ?? null),
		]);
		bike = nextBike ?? snapshot?.bike ?? null;
		shoes = nextShoes ?? snapshot?.shoes ?? null;
	}

	const next = { activities, bike, shoes, ytd, updatedAt: new Date().toISOString() };
	await writeJson(store, PUBLIC_KEY, next);
	return next;
}

export default async function handler(req) {
	const store = getTrainingStore();
	const [existing, cursor, snapshot, runnaPlan] = await Promise.all([
		readJson(store, INDEX_KEY, []),
		readJson(store, CURSOR_KEY, {}),
		readJson(store, PUBLIC_KEY, null),
		readJson(store, RUNNA_PLAN_KEY, null),
	]);

	// This tick works from the plan as last synced; the refresh below lands for
	// the next one (and for the page, which reads the blob directly).
	const plan = combinePlans(loadPlan(), runnaPlan);

	// Started rather than awaited. It shares no state, token or rate limit
	// with the Strava work below, which is allowed to spend twenty seconds,
	// and there's no reason three quick requests should queue behind it.
	const recoveryWork = syncRecovery(store, torontoToday());
	const planWork = syncRunnaPlan(store, runnaPlan, torontoToday());

	const report = async (fields) =>
		jsonResponse({
			ok: true,
			scanned: 0,
			runs: 0,
			synced: 0,
			notesRefreshed: 0,
			notesFresh: false,
			captioned: 0,
			captionUrlRejected: false,
			stored: (existing || []).length,
			missing: cursor?.missing ?? 0,
			stale: cursor?.stale ?? 0,
			shapeVersion: SHAPE_VERSION,
			rescan: false,
			rateLimited: false,
			quotaPaused: false,
			timedOut: false,
			...fields,
			recovery: await recoveryWork,
			plan: await planWork,
		});
	const stoodDown = () => report({ rateLimited: true });

	// A 429 still counts against the daily quota, so retrying every five
	// minutes after a blowout is what keeps every function 429ing until
	// midnight UTC. The cursor timestamp survives a cold start; skip Strava
	// entirely until it expires (Oura is a different API and still runs).
	if (Date.parse(cursor?.rateLimitedUntil || "") > Date.now()) {
		return stoodDown();
	}

	let strava;
	try {
		strava = await openStravaClient({ share: QUOTA_SHARE });
	} catch (err) {
		if (err.code === "not_configured") return jsonResponse({ error: "not_configured" }, 503);
		console.error(err);
		return jsonResponse({ error: "auth_failed" }, 502);
	}

	const full = new URL(req.url).searchParams.get("full") === "1";

	let summaries;
	try {
		summaries = await fetchActivitiesSince(strava, listingAfter({ cursor, plan, full }));
	} catch (err) {
		console.error("Strava activity list failed", err);
		if (err.status === 429) {
			await writeJson(store, CURSOR_KEY, {
				...cursor,
				lastRunAt: new Date().toISOString(),
				rateLimitedUntil: strava.cooldownUntil(),
			});
			return stoodDown();
		}
		return jsonResponse({ error: "strava_failed" }, 502);
	}

	try {
		await updatePublicSnapshot(store, strava, snapshot, summaries);
	} catch (err) {
		if (err.status === 429) {
			console.warn("Strava rate limit hit while updating the public snapshot");
		} else {
			console.error("public snapshot update failed", err);
		}
	}

	const { candidates, queue, enrich: batch } = queueWork({ summaries, existing, full });

	// Fetched once and then kept. Zones only move when the athlete edits them,
	// and since they're now the third choice behind a measured threshold (see
	// zones.js) they usually aren't read at all — so re-reading them on every
	// invocation of a backfill was a call a minute spent on a value that
	// mostly doesn't apply. ?full=1 picks up an edit.
	const storedZones = await readJson(store, ATHLETE_KEY, null);
	const zones = (storedZones && !full ? null : await fetchAthleteZones(strava)) || storedZones;

	const deadline = Date.now() + WORK_DEADLINE_MS;
	const { shaped, rateLimited, quotaPaused, timedOut } = await enrich(batch, {
		strava,
		thresholds: plan.thresholds,
		zones,
		deadline,
	});
	const merged = mergeActivities(existing, shaped);

	const today = torontoToday();
	const settled = settleSync({
		cursor,
		existing,
		candidates,
		queued: queue.length,
		shaped,
		merged,
		rateLimited,
		quotaPaused,
		today,
	});

	// Deliberately after the index is merged, and deliberately not part of
	// the queue: nothing here can make a record pending, so a sweep that runs
	// out of budget just leaves a note until the next pass.
	const notesRefreshed = settled.sweepNotes
		? await refreshNotes(merged, strava, today, deadline)
		: 0;

	// The one write. A new run that has numbers gets a fenced block on its
	// Strava description; a later pass sees the stamp (or the fence) and
	// leaves it.
	const captions = settled.caption
		? await caption(merged, plan, today, strava, deadline)
		: { captioned: 0, urlRejected: false };

	await Promise.all([
		writeJson(store, INDEX_KEY, merged),
		zones ? writeJson(store, ATHLETE_KEY, zones) : Promise.resolve(),
		// The cooldown is read now, not earlier, so a 429 during the sweep or a
		// caption still sticks across a cold start.
		writeJson(store, CURSOR_KEY, { ...settled.cursor, rateLimitedUntil: strava.cooldownUntil() }),
	]);

	return report({
		scanned: summaries.length,
		runs: candidates.length,
		synced: shaped.length,
		notesRefreshed,
		// Whether the sweep is on the five-minute cadence or the hourly one,
		// which is otherwise only visible as a read count in Strava's quota.
		notesFresh: settled.notesFresh,
		captioned: captions.captioned,
		captionUrlRejected: captions.urlRejected,
		stored: merged.length,
		missing: settled.missing,
		stale: settled.stale,
		rescan: full,
		rateLimited: rateLimited || strava.coolingDown(),
		quotaPaused,
		timedOut,
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
