// Full detail for one run in the block, read from Blobs on demand.
//
// The /training run log ships the lean publicRun for every activity — the
// trace, per-kilometre splits and zone breakdown that make a run worth opening
// are most of the payload and most of them are never looked at. Rather than
// carry all of that for thirty runs on every page, the log asks for it here
// when a run is actually opened.
//
// No auth and no Strava call: like trainingData this reads the index and runs
// pure functions. Everything the detail needs was resolved from the streams at
// sync time and is sitting in index.json — this just reshapes one record of it.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { INDEX_KEY, getTrainingStore, readJson } from "./_shared/training/store.js";
import { runDetailById } from "./_shared/training/metrics.js";
import { loadPlan } from "./_shared/training/planFile.js";
import { torontoToday } from "./_shared/training/dates.js";

// A completed run's numbers don't change, but daysAgo drifts and a note can
// land within a few days, so match trainingData: the browser revalidates and
// the edge holds a copy for a minute to dedupe repeat opens.
const jsonResponse = createJsonResponder(cacheControl.edgeBurst(60));
const errResponse = createJsonResponder(cacheControl.none);

export default async function handler(req) {
	const id = new URL(req.url).searchParams.get("id");
	if (!id) return errResponse({ error: "missing_id" }, 400);

	try {
		const store = getTrainingStore();
		const activities = await readJson(store, INDEX_KEY, []);
		const run = runDetailById({
			activities: Array.isArray(activities) ? activities : [],
			plan: loadPlan(),
			today: torontoToday(),
			id,
		});
		if (!run) return errResponse({ error: "not_found" }, 404);
		return jsonResponse({ run });
	} catch (err) {
		console.error("training activity detail failed", err);
		return errResponse({ error: "unavailable" }, 503);
	}
}
