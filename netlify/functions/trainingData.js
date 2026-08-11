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
// burst of traffic costs one function invocation per ten minutes rather than
// one per visitor, and can't affect the Strava rate limit at all.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { buildDashboard } from "./_shared/training/metrics.js";
import { loadPlan } from "./_shared/training/planFile.js";
import { INDEX_KEY, getTrainingStore, readJson } from "./_shared/training/store.js";
import { toDayKey } from "./_shared/training/dates.js";

// The underlying data only changes when the hourly sync runs, so a 10-minute
// CDN cache with a 30-minute stale window costs nothing in freshness.
const jsonResponse = createJsonResponder(cacheControl.swr(600, 1800));
const errResponse = createJsonResponder(cacheControl.none);

// Absorb bursts that get past a cold edge cache.
const memo = createMemo(60_000);

async function build(today) {
	const store = getTrainingStore();
	const activities = await readJson(store, INDEX_KEY, []);
	return buildDashboard({
		activities: Array.isArray(activities) ? activities : [],
		plan: loadPlan(),
		today,
	});
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
