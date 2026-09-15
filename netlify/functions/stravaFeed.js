// Returns up to 30 recent activities from the public Strava snapshot.
// Walks ≥7km, runs ≥5km, rides ≥10km — filtered when trainingSync writes
// the blob, not here. Callers still decide how to split by type.
//
// Also carries bike, shoes, and YTD totals from the same blob so a page
// that already asked for the feed does not need a second function for
// the profile footer (dashboard widget, intro modals).
//
// Used by:
//   - Dashboard StravaWidget       (asks for limit=30, slices to 5)
//   - Intro Activity Modals        (asks for limit=30; client filters
//                                   to run / ride and slices to display)
//   - /toronto map route overlay   (asks for limit=30; keeps the ones
//                                   whose polyline touches the GTA)
//
// Never calls Strava. trainingSync is the only writer; this is the same
// cheap-read pattern as trainingData.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { publicSnapshotBody } from "./_shared/stravaPublic.js";
import { loadPublicSnapshot } from "./_shared/training/store.js";

const jsonResponse = createJsonResponder(cacheControl.swr(300, 600));
const memo = createMemo(60_000);
const HARD_MAX = 30;

export default async function handler(req) {
	const url = new URL(req.url);
	const limitParam = parseInt(url.searchParams.get("limit"), 10);
	const limit = Math.min(
		Number.isFinite(limitParam) && limitParam > 0 ? limitParam : HARD_MAX,
		HARD_MAX,
	);

	const snapshot = await memo("public", loadPublicSnapshot);
	const body = publicSnapshotBody(snapshot, { activitiesLimit: limit });
	// An empty blob is "not seeded yet", not a stable empty feed. Caching it
	// for five minutes makes the first successful sync invisible until the
	// CDN/browser TTL expires.
	const headers = body.activities.length ? {} : cacheControl.none;
	return jsonResponse(body, 200, headers);
}
