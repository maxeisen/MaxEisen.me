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
import { loadDashboard, torontoToday } from "./_shared/training/dashboard.js";

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

export default async function handler() {
	const today = torontoToday();

	try {
		const payload = await memo(`dashboard:${today}`, () => loadDashboard(today));
		return jsonResponse(payload);
	} catch (err) {
		console.error("training dashboard build failed", err);
		return errResponse({ error: "unavailable" }, 503);
	}
}
