// Returns the athlete's primary gear (bike + shoes) and year-to-date totals
// for running and riding. Used by the intro modals on the homepage.
//
// Two upstream calls in parallel:
//   GET /athlete            -> bikes[], shoes[] (each has `primary` flag)
//   GET /athletes/{id}/stats -> ytd_ride_totals, ytd_run_totals
//
// This data changes slowly, so a 5-minute browser cache is fine.

import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { STRAVA_API_BASE, getAccessToken } from "./_shared/strava.js";

const ATHLETE_ID = 92118908;

const jsonResponse = createJsonResponder(cacheControl.swr(300, 600));

// Profile + YTD totals change slowly; memoize to absorb bursts past the edge.
const memo = createMemo(60_000);

function pickPrimary(items) {
	if (!Array.isArray(items) || items.length === 0) return null;
	const primary = items.find((i) => i.primary) || items[0];
	return {
		id: primary.id,
		name: primary.name || null,
		distance: primary.distance || 0,
	};
}

function shapeTotals(t) {
	if (!t) return null;
	return {
		count: t.count || 0,
		distance: t.distance || 0,
		movingTime: t.moving_time || 0,
		elevationGain: t.elevation_gain || 0,
	};
}

async function fetchProfile(token) {
	const headers = { "Authorization": `Bearer ${token}` };
	const [athleteRes, statsRes] = await Promise.all([
		fetch(`${STRAVA_API_BASE}/athlete`, { headers }),
		fetch(`${STRAVA_API_BASE}/athletes/${ATHLETE_ID}/stats`, { headers }),
	]);

	if (!athleteRes.ok || !statsRes.ok) {
		console.error("Strava profile failed:", athleteRes.status, statsRes.status);
		const e = new Error("strava_failed");
		e.code = "strava_failed";
		throw e;
	}

	const athlete = await athleteRes.json();
	const stats = await statsRes.json();

	return {
		bike: pickPrimary(athlete.bikes),
		shoes: pickPrimary(athlete.shoes),
		ytd: {
			run: shapeTotals(stats.ytd_run_totals),
			ride: shapeTotals(stats.ytd_ride_totals),
		},
	};
}

export default async function handler() {
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
	} catch {
		return jsonResponse({ error: "strava_failed" }, 502);
	}
}
