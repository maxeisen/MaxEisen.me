// The dashboard widgets' view of training: a couple of kilobytes picked out
// of the /running and /cycling payloads (see widgetSummary.js).
//
// No auth, for the same reason as trainingData: everything here is already
// on those public pages. Reads Blobs and runs pure functions; never calls
// Strava. If one sport's payload fails to build, the other still comes
// back, with that side null.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { loadDashboard, loadCyclingDashboard, torontoToday } from "./_shared/training/dashboard.js";
import { widgetSummary } from "./_shared/training/widgetSummary.js";

// Same cadence as the pages: the data moves when the 5-minute sync runs.
const jsonResponse = createJsonResponder(cacheControl.edgeBurst(60));
const errResponse = createJsonResponder(cacheControl.none);
const memo = createMemo(60_000);

async function build(today) {
	const [running, cycling] = await Promise.allSettled([
		loadDashboard(today),
		loadCyclingDashboard(today),
	]);
	if (running.status === "rejected" && cycling.status === "rejected") {
		throw running.reason;
	}
	if (running.status === "rejected") console.error("training summary: running failed", running.reason);
	if (cycling.status === "rejected") console.error("training summary: cycling failed", cycling.reason);
	return widgetSummary({
		running: running.status === "fulfilled" ? running.value : null,
		cycling: cycling.status === "fulfilled" ? cycling.value : null,
	});
}

export default async function handler() {
	const today = torontoToday();
	try {
		return jsonResponse(await memo(`summary:${today}`, () => build(today)));
	} catch (err) {
		console.error("training summary build failed", err);
		return errResponse({ error: "unavailable" }, 503);
	}
}
