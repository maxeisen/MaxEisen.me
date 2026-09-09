// Assemble the public /training payload: Blobs history plus the metrics engine.
// trainingData serves this as JSON; trainingPage renders the same object as HTML.

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

/** Toronto local date as a day key — "today" is the athlete's today, not UTC's. */
export function torontoToday() {
	return toDayKey(
		new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }),
	);
}

/**
 * Where the sync has got to, in the terms the page needs.
 * Only genuinely missing activities count as outstanding — a re-shape after
 * a SHAPE_VERSION bump is none of a reader's business.
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
