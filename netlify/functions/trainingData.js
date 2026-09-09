// Public training dashboard payload for /training.
//
// No auth: the page is public, and shape.js drops private activities and GPS
// before anything is stored. This reads Blobs and runs pure functions; it
// never calls Strava.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { loadDashboard, torontoToday } from "./_shared/training/dashboard.js";

// The data changes when the 5-minute sync runs. Edge holds a copy for a
// minute; the browser always revalidates so a reload after an upload can't
// miss data that has already landed.
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
