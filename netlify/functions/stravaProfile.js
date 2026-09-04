// Returns the athlete's most recently used gear (bike + shoes) and
// year-to-date totals for running and riding. Used by the intro modals
// on the homepage and the dashboard widget footer.
//
// Never calls Strava. trainingSync writes public.json; this reads it.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { emptyPublicSnapshot } from "./_shared/stravaPublic.js";
import { PUBLIC_KEY, getTrainingStore, readJson } from "./_shared/training/store.js";

const jsonResponse = createJsonResponder(cacheControl.swr(300, 600));
const memo = createMemo(60_000);

async function loadSnapshot() {
	return readJson(getTrainingStore(), PUBLIC_KEY, emptyPublicSnapshot());
}

export default async function handler() {
	const snapshot = await memo("public", loadSnapshot);
	const empty = emptyPublicSnapshot();
	return jsonResponse({
		bike: snapshot?.bike ?? empty.bike,
		shoes: snapshot?.shoes ?? empty.shoes,
		ytd: snapshot?.ytd ?? empty.ytd,
	});
}
