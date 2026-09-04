// Returns the athlete's most recently used gear (bike + shoes) and
// year-to-date totals for running and riding. Used by the intro modals
// on the homepage.
//
// Two upstream calls in parallel, then a name lookup per gear id:
//   GET /athlete/activities     -> newest-first listing with gear_id
//   GET /athletes/{id}/stats     -> ytd_ride_totals, ytd_run_totals
//   GET /gear/{id}              -> brand + model (nickname is a fallback)
//
// The old GET /athlete `primary` flag is the pre-"default gear by sport"
// global default and is no longer a reliable match for the UI. This data
// changes slowly, so a 5-minute browser cache is fine.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { STRAVA_API_BASE, getAccessToken, isCoolingDown, noteRateLimit, rateLimitCacheHeaders } from "./_shared/strava.js";
import { mostRecentGearId, shapeGear } from "./_shared/stravaGear.js";

const ATHLETE_ID = 92118908;

const jsonResponse = createJsonResponder(cacheControl.swr(300, 600));

// Profile + YTD totals change slowly; memoize to absorb bursts past the edge.
const memo = createMemo(60_000);

function shapeTotals(t) {
	if (!t) return null;
	return {
		count: t.count || 0,
		distance: t.distance || 0,
		movingTime: t.moving_time || 0,
		elevationGain: t.elevation_gain || 0,
	};
}

async function fetchGear(token, id) {
	if (!id) return null;
	const res = await fetch(`${STRAVA_API_BASE}/gear/${id}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) {
		console.error("Strava gear failed:", id, res.status);
		return null;
	}
	return shapeGear(await res.json());
}

async function fetchProfile(token) {
	const headers = { Authorization: `Bearer ${token}` };
	const [activitiesRes, statsRes] = await Promise.all([
		fetch(`${STRAVA_API_BASE}/athlete/activities?per_page=100`, { headers }),
		fetch(`${STRAVA_API_BASE}/athletes/${ATHLETE_ID}/stats`, { headers }),
	]);

	if (!activitiesRes.ok || !statsRes.ok) {
		console.error("Strava profile failed:", activitiesRes.status, statsRes.status);
		for (const res of [activitiesRes, statsRes]) {
			if (res.status === 429) noteRateLimit(res.headers);
		}
		const e = new Error("strava_failed");
		e.code = "strava_failed";
		e.status = activitiesRes.status === 429 || statsRes.status === 429 ? 429 : 502;
		throw e;
	}

	const activities = await activitiesRes.json();
	const stats = await statsRes.json();

	const [bike, shoes] = await Promise.all([
		fetchGear(token, mostRecentGearId(activities, "ride")),
		fetchGear(token, mostRecentGearId(activities, "run")),
	]);

	return {
		bike,
		shoes,
		ytd: {
			run: shapeTotals(stats.ytd_run_totals),
			ride: shapeTotals(stats.ytd_ride_totals),
		},
	};
}

export default async function handler() {
	if (isCoolingDown()) {
		return jsonResponse({ error: "strava_failed" }, 429, rateLimitCacheHeaders());
	}

	let token;
	try {
		token = await getAccessToken();
	} catch (err) {
		if (err.code === "not_configured") return jsonResponse({ error: "not_configured" }, 503);
		console.error(err);
		return jsonResponse({ error: "auth_failed" }, 502);
	}

	try {
		const payload = await memo("profile", () => fetchProfile(token));
		return jsonResponse(payload);
	} catch (err) {
		if (err.status === 429 || isCoolingDown()) {
			return jsonResponse({ error: "strava_failed" }, 429, rateLimitCacheHeaders());
		}
		return jsonResponse({ error: "strava_failed" }, 502);
	}
}
