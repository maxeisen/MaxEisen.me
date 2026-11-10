// Full detail for one ride, read from Blobs. No Strava call.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { ACTIVITY_ID_RE, loadActivityIndex } from "./_shared/training/store.js";
import { createMemo } from "./_shared/memo.js";
import { rideDetailById } from "./_shared/training/cycling.js";
import { loadPlan } from "./_shared/training/planFile.js";
import { torontoToday } from "./_shared/training/dates.js";

const jsonResponse = createJsonResponder(cacheControl.edgeBurst(60));
const errResponse = createJsonResponder(cacheControl.none);

// Opening a few activities in a row would otherwise read the whole index from
// Blobs once per click. The sync only writes every five minutes and the edge
// holds responses for a minute anyway, so a minute here is no worse.
const indexMemo = createMemo(60_000);

export default async function handler(req) {
	const id = new URL(req.url).searchParams.get("id");
	if (!id) return errResponse({ error: "missing_id" }, 400);
	if (!ACTIVITY_ID_RE.test(id)) return errResponse({ error: "invalid_id" }, 400);

	try {
		const activities = await indexMemo("index", loadActivityIndex);
		const ride = rideDetailById({
			activities,
			today: torontoToday(),
			thresholds: loadPlan()?.thresholds || {},
			id,
		});
		if (!ride) return errResponse({ error: "not_found" }, 404);
		return jsonResponse({ ride });
	} catch (err) {
		console.error("cycling activity detail failed", err);
		return errResponse({ error: "unavailable" }, 503);
	}
}
