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
	const start = Date.now();
	const res = await timedFetch(
		"token",
		"https://accounts.spotify.com/api/token",
		{
			method: "POST",
			headers: {
				"Authorization": `Basic ${auth}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: refreshToken,
			}),
		},
		5000,
	);
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Spotify token refresh failed: ${res.status} ${text}`);
	}
	const data = await res.json();
	cachedToken = {
		token: data.access_token,
		expiresAt: Date.now() + data.expires_in * 1000,
	};
	console.log(`[spotify] token refreshed in ${Date.now() - start}ms, expires in ${data.expires_in}s`);
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

// Wrap fetch in an abort-controller timeout so a stuck Spotify call can't
// drag the function out to 4–8 seconds (visible in Netlify logs). 4s is a
// generous cap — Spotify normally responds in <500ms.
async function timedFetch(label, url, options = {}, ms = 4000) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), ms);
	const start = Date.now();
	try {
		const res = await fetch(url, { ...options, signal: ctrl.signal });
		console.log(`[spotify] ${label} ${res.status} in ${Date.now() - start}ms`);
		return res;
	} catch (err) {
		console.log(`[spotify] ${label} ${err.name || "fail"} in ${Date.now() - start}ms`);
		throw err;
	} finally {
		clearTimeout(t);
	}
}

// Spotify's docs note that a 500 from the Web API is most often a token
// validation issue, not an actual upstream outage. 401 is the same root cause
// with a clearer status. Either way, invalidate the cached access token and
// pull a fresh one, then retry once.
const TOKEN_INVALID_STATUSES = new Set([401, 500]);

async function callPlayerEndpoint(label, path) {
	let token = await getAccessToken();
	let res;
	try {
		res = await timedFetch(label, `https://api.spotify.com${path}`, {
			headers: { "Authorization": `Bearer ${token}` },
		});
	} catch (err) {
		// AbortError from the timeout, or a network error.
		return { res: null, err };
	}
	if (TOKEN_INVALID_STATUSES.has(res.status)) {
		// Force a fresh token (Spotify can invalidate earlier than expires_in).
		console.log(`[spotify] ${label} got ${res.status}, refreshing token and retrying`);
		cachedToken = null;
		try {
			token = await getAccessToken();
		} catch (err) {
			return { res, err };
		}
		try {
			res = await timedFetch(`${label}:retry`, `https://api.spotify.com${path}`, {
				headers: { "Authorization": `Bearer ${token}` },
			});
		} catch (err) {
			return { res: null, err };
		}
	}
	return { res, err: null };
}

async function fetchPayload() {
	try {
		await getAccessToken();
	} catch (err) {
		if (err.code === "not_configured") return { status: 503, body: { error: "not_configured" } };
		console.error("[spotify] auth failed:", err.message);
		return { status: 502, body: { error: "auth_failed" } };
	}

	const { res: nowRes, err: nowErr } = await callPlayerEndpoint(
		"now",
		"/v1/me/player/currently-playing?additional_types=track,episode"
	);

	// Spotify-side rate limit (rare for the volume we send, but easy to detect).
	if (nowRes?.status === 429) {
		const retryAfter = nowRes.headers.get("Retry-After") || "1";
		console.warn("[spotify] rate limited, retry-after:", retryAfter);
		return { status: 503, body: { error: "rate_limited", retryAfter: Number(retryAfter) || null, playing: false } };
	}

	if (nowRes?.status === 200) {
		const data = await nowRes.json();
		if (data && data.item) {
			// Get the token for the genre fetch (will use the (possibly refreshed) cache).
			const token = await getAccessToken();
			const shape = shapeTrack(data.item, !!data.is_playing, { progressMs: data.progress_ms || 0 });
			shape.genre = await fetchPrimaryGenreCached(shape.artistIds, token);
			delete shape.artistIds;
			return { status: 200, body: shape };
		}
	}

	// If the player endpoint aborted (network/Spotify is slow), don't burn
	// another 4s on the fallback — the same network path will likely hang too.
	// Return 503 immediately and let the client stickiness ride it out.
	if (nowErr?.name === "AbortError" || (!nowRes && nowErr)) {
		console.warn("[spotify] currently-playing aborted, skipping fallback");
		return {
			status: 503,
			body: { error: "spotify_slow", upstream: [null, null], playing: false },
		};
	}

	// 204 / empty 200 — fall back to recently-played.
	const { res: recentRes, err: recentErr } = await callPlayerEndpoint("recent", "/v1/me/player/recently-played?limit=1");
	if (recentRes?.status === 429) {
		const retryAfter = recentRes.headers.get("Retry-After") || "1";
		console.warn("[spotify] rate limited on fallback, retry-after:", retryAfter);
		return { status: 503, body: { error: "rate_limited", retryAfter: Number(retryAfter) || null, playing: false } };
	}
	if (!recentRes || !recentRes.ok) {
		console.warn(
			"[spotify] both endpoints failed:",
			nowRes?.status ?? `err:${nowErr?.name || "fetch"}`,
			recentRes?.status ?? `err:${recentErr?.name || "fetch"}`,
		);
		return {
			status: 503,
			body: {
				error: "spotify_unavailable",
				upstream: [nowRes?.status ?? null, recentRes?.status ?? null],
				playing: false,
			},
		};
	}
	const recentData = await recentRes.json();
	const item = recentData.items?.[0];
	if (!item) return { status: 200, body: { playing: false } };
	const token = await getAccessToken();
	const shape = shapeTrack(item.track, false, { playedAt: item.played_at });
	shape.genre = await fetchPrimaryGenreCached(shape.artistIds, token);
	delete shape.artistIds;
	return { status: 200, body: shape };
}

export default async function handler() {
	const { status, body } = await fetchPayload();
	return jsonResponse(body, status);
}
