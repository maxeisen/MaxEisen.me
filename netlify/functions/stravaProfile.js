// Returns the athlete's most recently used gear (bike + shoes) and
// year-to-date totals for running and riding. Used by the intro modals
// on the homepage and the dashboard widget footer.
//
// Never calls Strava. trainingSync writes public.json; this reads it.
// Prefer stravaFeed when the caller also needs activities — that endpoint
// now returns the same profile fields from the same blob.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { publicSnapshotBody } from "./_shared/stravaPublic.js";
import { loadPublicSnapshot } from "./_shared/training/store.js";

const jsonResponse = createJsonResponder(cacheControl.swr(300, 600));
const memo = createMemo(60_000);

export default async function handler() {
	const snapshot = await memo("public", loadPublicSnapshot);
	const body = publicSnapshotBody(snapshot);
	const seeded = body.bike || body.shoes || body.ytd?.run || body.ytd?.ride;
	return jsonResponse(body, 200, seeded ? {} : cacheControl.none);
}
