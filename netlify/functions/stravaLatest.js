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
			"Cache-Control": "public, max-age=120, stale-while-revalidate=300",
		},
	});
}

let cachedToken = null; // { token, expiresAt }

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
	const res = await fetch("https://www.strava.com/api/v3/oauth/token", {
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
	cachedToken = {
		token: data.access_token,
		expiresAt: data.expires_at * 1000,
	};
	return cachedToken.token;
}

// Filters: walks ≥7km, runs ≥5km, rides ≥20km
function passesFilter(activity) {
	const type = activity.sport_type || activity.type || "";
	const distance = activity.distance || 0;
	if (/Walk|Hike/i.test(type)) return distance >= 7000;
	if (/Run/i.test(type)) return distance >= 5000;
	if (/Ride/i.test(type)) return distance >= 20000;
	return false;
}

function matchesType(activity, type) {
	const t = activity.sport_type || activity.type || "";
	if (type === "run") return /Run/i.test(t);
	if (type === "ride") return /Ride/i.test(t);
	if (type === "walk") return /Walk|Hike/i.test(t);
	return true;
}

const DEFAULT_MAX = 5;
const FILTERED_MAX = 10;
// Pull a wider window when the caller wants only one activity type so
// distance-filtered runs/rides aren't crowded out by other recent activities.
const PER_PAGE_DEFAULT = 30;
const PER_PAGE_FILTERED = 100;

export default async function handler(req) {
	const url = new URL(req.url);
	const typeParam = (url.searchParams.get("type") || "").toLowerCase() || null;
	const allowedTypes = new Set(["run", "ride", "walk"]);
	const type = allowedTypes.has(typeParam) ? typeParam : null;
	const limit = type
		? Math.min(parseInt(url.searchParams.get("limit"), 10) || FILTERED_MAX, FILTERED_MAX)
		: DEFAULT_MAX;
	const perPage = type ? PER_PAGE_FILTERED : PER_PAGE_DEFAULT;

	let token;
	try {
		token = await getAccessToken();
	} catch (err) {
		if (err.code === "not_configured") {
			return jsonResponse({ error: "not_configured" }, 503);
		}
		console.error(err);
		return jsonResponse({ error: "auth_failed" }, 502);
	}

	const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`, {
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
		.filter((a) => matchesType(a, type))
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
		}));
	return jsonResponse({ activities: filtered });
}
