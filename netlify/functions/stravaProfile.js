// Returns the athlete's primary gear (bike + shoes) and year-to-date totals
// for running and riding. Used by the intro modals on the homepage.
//
// Two upstream calls in parallel:
//   GET /athlete            -> bikes[], shoes[] (each has `primary` flag)
//   GET /athletes/{id}/stats -> ytd_ride_totals, ytd_run_totals
//
// This data changes slowly, so a 5-minute browser cache is fine.

const ATHLETE_ID = 92118908;
// Strava is migrating off https://www.strava.com/api/v3 — the new base
// is api-v3.strava.com (announced Jun 2026, mandatory by Jun 1, 2027).
// Pulled into a constant so a future revert / re-pin is a one-line edit.
const STRAVA_API_BASE = "https://www.api-v3.strava.com";

function getEnv(name) {
	if (typeof Netlify !== "undefined" && Netlify.env?.get) {
		return Netlify.env.get(name);
	}
	return process.env[name];
}

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=300, stale-while-revalidate=600",
		},
	});
}

let cachedToken = null;

async function getAccessToken() {
	if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
		return cachedToken.token;
	}
	const clientId = getEnv("STRAVA_CLIENT_ID");
	const clientSecret = getEnv("STRAVA_CLIENT_SECRET");
	const refreshToken = getEnv("STRAVA_REFRESH_TOKEN");
	if (!clientId || !clientSecret || !refreshToken) {
		const err = new Error("Strava env vars missing");
		err.code = "not_configured";
		throw err;
	}
	const res = await fetch(`${STRAVA_API_BASE}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: "refresh_token",
			refresh_token: refreshToken,
		}),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Strava token refresh failed: ${res.status} ${text}`);
	}
	const data = await res.json();
	cachedToken = { token: data.access_token, expiresAt: data.expires_at * 1000 };
	return cachedToken.token;
}

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

export default async function handler() {
	let token;
	try {
		token = await getAccessToken();
	} catch (err) {
		if (err.code === "not_configured") return jsonResponse({ error: "not_configured" }, 503);
		console.error(err);
		return jsonResponse({ error: "auth_failed" }, 502);
	}

	const headers = { "Authorization": `Bearer ${token}` };
	const [athleteRes, statsRes] = await Promise.all([
		fetch(`${STRAVA_API_BASE}/athlete`, { headers }),
		fetch(`${STRAVA_API_BASE}/athletes/${ATHLETE_ID}/stats`, { headers }),
	]);

	if (!athleteRes.ok || !statsRes.ok) {
		console.error("Strava profile failed:", athleteRes.status, statsRes.status);
		return jsonResponse({ error: "strava_failed" }, 502);
	}

	const athlete = await athleteRes.json();
	const stats = await statsRes.json();

	return jsonResponse({
		bike: pickPrimary(athlete.bikes),
		shoes: pickPrimary(athlete.shoes),
		ytd: {
			run: shapeTotals(stats.ytd_run_totals),
			ride: shapeTotals(stats.ytd_ride_totals),
		},
	});
}
