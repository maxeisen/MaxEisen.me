// Returns up to 30 recent activities from Strava that pass the distance
// filter (walks ≥7km, runs ≥5km, rides ≥20km). No server-side type
// filter — callers decide how to split or filter.
//
// Used by:
//   - Dashboard StravaWidget       (asks for limit=5 — mixed list)
//   - Intro Activity Modals        (asks for limit=30; client filters
//                                   to run / ride and slices to display)
//   - /toronto map route overlay   (asks for limit=30; keeps the ones
//                                   whose polyline touches the GTA)

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { STRAVA_API_BASE, getAccessToken } from "./_shared/strava.js";

// All callers use the same URL (`?limit=30`), so there's only one cache key —
// Netlify Edge's stale-while-revalidate can't collapse cross-query variants
// the way it did when we had `?type=run`/`?type=ride`. max-age aligns with the
// dashboard widget's 5-min poll cycle so upstream Strava fires ~12×/hour.
const jsonResponse = createJsonResponder(cacheControl.swr(300, 600));

// Absorb bursts past the CDN edge cache. The upstream fetch + filter is
// memoized as the full qualifying list (every caller asks for the same data);
// each request just slices it to its own `limit`.
const memo = createMemo(60_000);

const HARD_MAX = 30;
const PER_PAGE = 100;

// Distance thresholds (in metres) for "qualifying" activities — these
// keep the surfaces from listing 1-km warm-up jogs and the like.
function passesFilter(activity) {
	const type = activity.sport_type || activity.type || "";
	const distance = activity.distance || 0;
	if (/Walk|Hike/i.test(type)) return distance >= 7000;
	if (/Run/i.test(type)) return distance >= 5000;
	if (/Ride/i.test(type)) return distance >= 20000;
	return false;
}

// Fetch + filter + shape the full qualifying feed (no slice). Throws an Error
// tagged `.code = "strava_failed"` when the upstream call fails.
async function fetchFeed(token) {
	const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?per_page=${PER_PAGE}`, {
		headers: { "Authorization": `Bearer ${token}` },
	});
	if (!res.ok) {
		const text = await res.text();
		console.error("Strava activities failed:", res.status, text);
		const e = new Error("strava_failed");
		e.code = "strava_failed";
		throw e;
	}

	const activities = await res.json();
	return activities
		.filter(passesFilter)
		.map((a) => ({
			id: a.id,
			name: a.name,
			type: a.sport_type || a.type,
			distance: a.distance,
			movingTime: a.moving_time,
			elapsedTime: a.elapsed_time,
			elevationGain: a.total_elevation_gain,
			startDate: a.start_date,
			polyline: a.map?.summary_polyline || null,
			sufferScore: a.suffer_score ?? null,
		}));
}

export default async function handler(req) {
	const url = new URL(req.url);
	const limitParam = parseInt(url.searchParams.get("limit"), 10);
	const limit = Math.min(
		Number.isFinite(limitParam) && limitParam > 0 ? limitParam : HARD_MAX,
		HARD_MAX,
	);

	let token;
	try {
		token = await getAccessToken();
	} catch (err) {
		if (err.code === "not_configured") return jsonResponse({ error: "not_configured" }, 503);
		console.error(err);
		return jsonResponse({ error: "auth_failed" }, 502);
	}

	let all;
	try {
		all = await memo("feed", () => fetchFeed(token));
	} catch {
		return jsonResponse({ error: "strava_failed" }, 502);
	}
	return jsonResponse({ activities: all.slice(0, limit) });
}
