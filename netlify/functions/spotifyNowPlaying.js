function getEnv(name) {
	if (typeof Netlify !== "undefined" && Netlify.env?.get) {
		return Netlify.env.get(name);
	}
	return process.env[name];
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
	// Now-playing state changes second-to-second — every request must hit the
	// function and return the live Spotify state. no-store also prevents the
	// browser, Netlify's CDN, and any intermediate proxy from serving a copy.
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
			"Pragma": "no-cache",
			"Expires": "0",
			...extraHeaders,
		},
	});
}

// Module-scoped cache. Netlify reuses warm function instances, so this saves
// token refresh round-trips when the function is hit frequently. The access
// token is per-app (not per-request), so caching it is safe across instances.
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
		id: item.id || null,
		track: item.name,
		artist: (item.artists || []).map((a) => a.name).join(", "),
		artistIds: (item.artists || []).map((a) => a.id).filter(Boolean),
		album: item.album?.name || null,
		albumArt: item.album?.images?.[0]?.url || null,
		url: item.external_urls?.spotify || null,
		durationMs: item.duration_ms || null,
		...extra,
	};
}

// Pull the artist's primary genre to use as a coarse vibe hint client-side.
async function fetchPrimaryGenre(artistIds, token) {
	if (!artistIds || artistIds.length === 0) return null;
	try {
		const res = await fetch(`https://api.spotify.com/v1/artists/${artistIds[0]}`, {
			headers: { "Authorization": `Bearer ${token}` },
		});
		if (!res.ok) return null;
		const a = await res.json();
		return a.genres?.[0] || null;
	} catch {
		return null;
	}
}

// Memoize genres per artist for the lifetime of a warm instance. Genres
// don't change, and this saves one Spotify call per repeat artist.
const genreCache = new Map();
async function fetchPrimaryGenreCached(artistIds, token) {
	if (!artistIds || artistIds.length === 0) return null;
	const id = artistIds[0];
	if (genreCache.has(id)) return genreCache.get(id);
	const genre = await fetchPrimaryGenre(artistIds, token);
	if (genre) genreCache.set(id, genre);
	return genre;
}

async function fetchPayload() {
	let token;
	try {
		token = await getAccessToken();
	} catch (err) {
		if (err.code === "not_configured") return { status: 503, body: { error: "not_configured" } };
		console.error("[spotify] auth failed:", err.message);
		return { status: 502, body: { error: "auth_failed" } };
	}

	const nowRes = await fetch(
		"https://api.spotify.com/v1/me/player/currently-playing?additional_types=track,episode",
		{ headers: { "Authorization": `Bearer ${token}` } }
	);

	// If Spotify is rate-limiting us, short-circuit immediately — calling the
	// fallback endpoint would just earn another 429 and the Retry-After header
	// tells us how long to back off anyway.
	if (nowRes.status === 429) {
		const retryAfter = nowRes.headers.get("Retry-After") || "1";
		console.warn("[spotify] rate limited, retry-after:", retryAfter);
		return {
			status: 503,
			body: { error: "rate_limited", retryAfter: Number(retryAfter) || null, playing: false },
		};
	}

	if (nowRes.status === 200) {
		const data = await nowRes.json();
		if (data && data.item) {
			const shape = shapeTrack(data.item, !!data.is_playing, { progressMs: data.progress_ms || 0 });
			shape.genre = await fetchPrimaryGenreCached(shape.artistIds, token);
			delete shape.artistIds;
			return { status: 200, body: shape };
		}
	}

	// 204 No Content (or empty 200) — fall back to recently played
	const recentRes = await fetch(
		"https://api.spotify.com/v1/me/player/recently-played?limit=1",
		{ headers: { "Authorization": `Bearer ${token}` } }
	);
	if (recentRes.status === 429) {
		const retryAfter = recentRes.headers.get("Retry-After") || "1";
		console.warn("[spotify] rate limited on fallback, retry-after:", retryAfter);
		return {
			status: 503,
			body: { error: "rate_limited", retryAfter: Number(retryAfter) || null, playing: false },
		};
	}
	if (!recentRes.ok) {
		console.warn("[spotify] both endpoints failed:", nowRes.status, recentRes.status);
		return {
			status: 503,
			body: { error: "spotify_unavailable", upstream: [nowRes.status, recentRes.status], playing: false },
		};
	}
	const recentData = await recentRes.json();
	const item = recentData.items?.[0];
	if (!item) return { status: 200, body: { playing: false } };
	const shape = shapeTrack(item.track, false, { playedAt: item.played_at });
	shape.genre = await fetchPrimaryGenreCached(shape.artistIds, token);
	delete shape.artistIds;
	return { status: 200, body: shape };
}

export default async function handler() {
	const { status, body } = await fetchPayload();
	return jsonResponse(body, status);
}
