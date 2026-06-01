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
			// Browser-only cache. Avoids Netlify Edge's
			// stale-while-revalidate from collapsing query-string variants.
			"Cache-Control": "private, max-age=60",
		},
	});
}

// Strava announced a Jun 2027 migration to https://www.api-v3.strava.com,
// but in practice that host returns 4xx for /oauth/token, /athlete, and
// /athletes/{id}/stats as of Jun 2026. Stay on the legacy base across
// every endpoint until the new host is fully populated. stravaProfile
// does the same; flip both constants when revisiting before Jun 2027.
const STRAVA_API_BASE = "https://www.strava.com/api/v3";
const HARD_MAX = 30;
const PER_PAGE = 100;

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

	const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?per_page=${PER_PAGE}`, {
		headers: { "Authorization": `Bearer ${token}` },
	});
	if (!res.ok) {
		const text = await res.text();
		console.error("Strava activities failed:", res.status, text);
		return jsonResponse({ error: "strava_failed" }, 502);
	}

	const activities = await res.json();
	const filtered = activities
		.filter(passesFilter)
		.slice(0, limit)
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
	return jsonResponse({ activities: filtered });
}
