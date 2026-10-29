// Public cycling dashboard payload. Reads Blobs and never calls Strava.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { loadCyclingDashboard, torontoToday } from "./_shared/training/dashboard.js";

const jsonResponse = createJsonResponder(cacheControl.edgeBurst(60));
const errResponse = createJsonResponder(cacheControl.none);
const memo = createMemo(60_000);

export default async function handler() {
	const today = torontoToday();
	try {
		const payload = await memo(`cycling:${today}`, () => loadCyclingDashboard(today));
		return jsonResponse(payload);
	} catch (err) {
		console.error("cycling dashboard build failed", err);
		return errResponse({ error: "unavailable" }, 503);
	}
}
