// Full detail for one ride, read from Blobs. No Strava call.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { INDEX_KEY, getTrainingStore, readJson } from "./_shared/training/store.js";
import { rideDetailById } from "./_shared/training/cycling.js";
import { loadPlan } from "./_shared/training/planFile.js";
import { torontoToday } from "./_shared/training/dates.js";

const jsonResponse = createJsonResponder(cacheControl.edgeBurst(60));
const errResponse = createJsonResponder(cacheControl.none);

export default async function handler(req) {
	const id = new URL(req.url).searchParams.get("id");
	if (!id) return errResponse({ error: "missing_id" }, 400);

	try {
		const store = getTrainingStore();
		const activities = await readJson(store, INDEX_KEY, []);
		const ride = rideDetailById({
			activities: Array.isArray(activities) ? activities : [],
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
