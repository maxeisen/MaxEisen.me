// Full detail for one run in the block, read from Blobs on demand.
//
// The /running run log ships the lean publicRun for every activity — the
// trace, per-kilometre splits and zone breakdown that make a run worth opening
// are most of the payload and most of them are never looked at. Rather than
// carry all of that for thirty runs on every page, the log asks for it here
// when a run is actually opened.
//
// No auth and no Strava call: like trainingData this reads the index and runs
// pure functions. Everything the detail needs was resolved from the streams at
// sync time and is sitting in index.json — this just reshapes one record of it.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { ACTIVITY_ID_RE, loadActivityIndex } from "./_shared/training/store.js";
import { createMemo } from "./_shared/memo.js";
import { runDetailById } from "./_shared/training/metrics.js";
import { loadTrainingPlan } from "./_shared/training/planFile.js";
import { torontoToday } from "./_shared/training/dates.js";

// A completed run's numbers don't change, but daysAgo drifts and a note can
// land within a few days, so match trainingData: the browser revalidates and
// the edge holds a copy for a minute to dedupe repeat opens.
const jsonResponse = createJsonResponder(cacheControl.edgeBurst(60));
const errResponse = createJsonResponder(cacheControl.none);

// Opening a few activities in a row would otherwise read the whole index from
// Blobs once per click. The sync only writes every five minutes and the edge
// holds responses for a minute anyway, so a minute here is no worse.
const indexMemo = createMemo(60_000);
const planMemo = createMemo(60_000);

export default async function handler(req) {
	const id = new URL(req.url).searchParams.get("id");
	if (!id) return errResponse({ error: "missing_id" }, 400);
	if (!ACTIVITY_ID_RE.test(id)) return errResponse({ error: "invalid_id" }, 400);

	try {
		const [activities, plan] = await Promise.all([
			indexMemo("index", loadActivityIndex),
			planMemo("plan", () => loadTrainingPlan()),
		]);
		const run = runDetailById({
			activities,
			plan,
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
