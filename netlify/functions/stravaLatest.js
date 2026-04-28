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

export default async function handler() {
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

	const res = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=1", {
		headers: { "Authorization": `Bearer ${token}` },
	});
	if (!res.ok) {
		const text = await res.text();
		console.error("Strava activities failed:", res.status, text);
		return jsonResponse({ error: "strava_failed" }, 502);
	}
	const activities = await res.json();
	const a = activities[0];
	if (!a) return jsonResponse({});
	return jsonResponse({
		id: a.id,
		name: a.name,
		type: a.sport_type || a.type,
		distance: a.distance,            // metres
		movingTime: a.moving_time,        // seconds
		elapsedTime: a.elapsed_time,
		elevationGain: a.total_elevation_gain,
		startDate: a.start_date,
	});
}
