// Assemble the public /training payload: Blobs history plus the metrics engine.
//
// trainingData serves this as JSON; trainingPage renders the same object as
// the no-JS HTML fallback. Both must see the same numbers, so the read and
// the sync accounting live here rather than in either handler.

import { buildDashboard } from "./metrics.js";
import { loadPlan } from "./planFile.js";
import {
	CURSOR_KEY,
	INDEX_KEY,
	RECOVERY_KEY,
	getTrainingStore,
	readJson,
} from "./store.js";
import { toDayKey } from "./dates.js";

/**
 * Toronto local date as a day key. The dashboard is a personal training log
 * in one timezone, so "today" should be the athlete's today rather than UTC's
 * — otherwise every evening run after 8pm would land on tomorrow.
 */
export function torontoToday() {
	return toDayKey(
		new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }),
	);
}

/**
 * Where the sync has got to, in the terms the page needs.
 *
 * Every metric here is a function of the whole history — fitness is a 42-day
 * average, and the race prediction reads the block's best efforts — so a
 * half-filled index doesn't produce slightly-off numbers, it produces numbers
 * for a training block the athlete didn't do. Until the backfill lands, that
 * has to be said out loud rather than left to look like a bad month.
 *
 * Only activities that are genuinely absent count. The sync also tracks runs
 * it means to re-shape after a SHAPE_VERSION bump, and those are none of a
 * reader's business: the run is stored, the history is whole, and some of its
 * numbers are about to move slightly. See the accounting in trainingSync.
 */
export function syncState(cursor) {
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

/**
 * @param {string} [today] day key; defaults to Toronto today.
 * @returns {Promise<object>} the trainingData payload, including `sync`.
 */
export async function loadDashboard(today = torontoToday()) {
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
