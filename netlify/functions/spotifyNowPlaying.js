function getEnv(name) {
	if (typeof Netlify !== "undefined" && Netlify.env?.get) {
		return Netlify.env.get(name);
	}
	return process.env[name];
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=30, stale-while-revalidate=60",
			...extraHeaders,
		},
	});
}

// Module-scoped cache. Netlify reuses warm function instances, so this saves
// token refresh round-trips when the function is hit frequently.
let cachedToken = null; // { token: string, expiresAt: number }

async function getAccessToken() {
	if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
		return cachedToken.token;
	}
	const clientId = getEnv("SPOTIFY_CLIENT_ID");
	const clientSecret = getEnv("SPOTIFY_CLIENT_SECRET");
	const refreshToken = getEnv("SPOTIFY_REFRESH_TOKEN");
	if (!clientId || !clientSecret || !refreshToken) {
		const err = new Error("Spotify env vars missing");
		err.code = "not_configured";
		throw err;
	}
	const auth = btoa(`${clientId}:${clientSecret}`);
	const res = await fetch("https://accounts.spotify.com/api/token", {
		method: "POST",
		headers: {
			"Authorization": `Basic ${auth}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
		}),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Spotify token refresh failed: ${res.status} ${text}`);
	}
	const data = await res.json();
	cachedToken = {
		token: data.access_token,
		expiresAt: Date.now() + data.expires_in * 1000,
	};
	return cachedToken.token;
}

function shapeTrack(item, playing, extra = {}) {
	if (!item) return { playing: false };
	return {
		playing,
		track: item.name,
		artist: (item.artists || []).map((a) => a.name).join(", "),
		album: item.album?.name || null,
		albumArt: item.album?.images?.[0]?.url || null,
		url: item.external_urls?.spotify || null,
		durationMs: item.duration_ms || null,
		...extra,
	};
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

	const nowRes = await fetch(
		"https://api.spotify.com/v1/me/player/currently-playing?additional_types=track,episode",
		{ headers: { "Authorization": `Bearer ${token}` } }
	);

	if (nowRes.status === 200) {
		const data = await nowRes.json();
		if (data && data.item) {
			return jsonResponse(
				shapeTrack(data.item, !!data.is_playing, {
					progressMs: data.progress_ms || 0,
				})
			);
		}
	}

	// 204 No Content (or empty response) — fall back to recently played
	const recentRes = await fetch(
		"https://api.spotify.com/v1/me/player/recently-played?limit=1",
		{ headers: { "Authorization": `Bearer ${token}` } }
	);
	if (!recentRes.ok) {
		return jsonResponse({ playing: false });
	}
	const recentData = await recentRes.json();
	const item = recentData.items?.[0];
	if (!item) return jsonResponse({ playing: false });
	return jsonResponse(shapeTrack(item.track, false, { playedAt: item.played_at }));
}
