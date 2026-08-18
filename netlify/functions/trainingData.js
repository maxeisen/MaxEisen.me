// Public training dashboard payload for /training.
//
// No auth: the page is public on purpose, as an accountability device for the
// 2026 Chicago Marathon. What keeps that safe is upstream, in
// _shared/training/shape.js — private activities are dropped and no coordinates
// are ever stored, so there is nothing sensitive here to gate. See
// trainingData.test.js, which asserts that end to end.
//
// This reads Blobs and runs pure functions; it never calls Strava. That's what
// makes it cheap enough to leave open — combined with the CDN cache below, a
// burst of traffic costs one function invocation per minute rather than one
// per visitor, and can't affect the Strava rate limit at all.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { buildDashboard } from "./_shared/training/metrics.js";
import { loadPlan } from "./_shared/training/planFile.js";
import {
	CURSOR_KEY,
	INDEX_KEY,
	RECOVERY_KEY,
	getTrainingStore,
	readJson,
} from "./_shared/training/store.js";
import { toDayKey } from "./_shared/training/dates.js";

// The data changes when the 5-minute sync runs, and the point of that cadence
// is a run appearing shortly after it uploads — so the cache must not be the
// thing that eats the gain.
//
// The edge holds a copy for a minute and the browser always revalidates
// against it, rather than a plain public max-age. Two reasons, and the second
// is the real one. A shared max-age lets a browser serve its own copy without
// asking, so the reload after an upload can miss data that has already landed;
// and stale-while-revalidate hands out the previous copy while it refreshes,
// which is exactly the wrong trade for someone refreshing *because* they
// expect something new. A burst still costs one origin call a minute, and the
// memo below makes that cheaper again.
const jsonResponse = createJsonResponder(cacheControl.edgeBurst(60));
const errResponse = createJsonResponder(cacheControl.none);

// Absorb bursts that get past a cold edge cache.
const memo = createMemo(60_000);

// Where the sync has got to, in the terms the page needs.
//
// Every metric here is a function of the whole history — fitness is a 42-day
// average, and the race prediction reads the block's best efforts — so a
// half-filled index doesn't produce slightly-off numbers, it produces numbers
// for a training block the athlete didn't do. Until the backfill lands, that
// has to be said out loud rather than left to look like a bad month.
//
// Only activities that are genuinely absent count. The sync also tracks runs
// it means to re-shape after a SHAPE_VERSION bump, and those are none of a
// reader's business: the run is stored, the history is whole, and some of its
// numbers are about to move slightly. See the accounting in trainingSync.
function syncState(cursor) {
	const missing = Number(cursor?.missing);
	const pending = Number.isFinite(missing) ? Math.max(0, missing) : 0;
	return {
		lastRunAt: cursor?.lastRunAt || null,
		// No cursor at all means the scheduled sync has never completed —
		// on a fresh deploy the page is live before the first tick fires.
		hasSynced: Boolean(cursor?.lastRunAt),
		outstanding: pending,
		backfilling: pending > 0,
	};
}

async function build(today) {
	const store = getTrainingStore();
	const [activities, cursor, recovery] = await Promise.all([
		readJson(store, INDEX_KEY, []),
		readJson(store, CURSOR_KEY, null),
		readJson(store, RECOVERY_KEY, []),
	]);
	return {
		...buildDashboard({
			activities: Array.isArray(activities) ? activities : [],
			plan: loadPlan(),
			today,
			recovery: Array.isArray(recovery) ? recovery : [],
		}),
		sync: syncState(cursor),
	};
}

export default async function handler() {
	// Toronto local date. The dashboard is a personal training log in one
	// timezone, so "today" should be the athlete's today rather than UTC's —
	// otherwise every evening run after 8pm would land on tomorrow.
	const today = toDayKey(
		new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }),
	);

	try {
		const payload = await memo(`dashboard:${today}`, () => build(today));
		return jsonResponse(payload);
	} catch (err) {
		console.error("training dashboard build failed", err);
		return errResponse({ error: "unavailable" }, 503);
	}
}
