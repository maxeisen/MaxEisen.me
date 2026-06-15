// Shared Strava OAuth token refresh, used by stravaProfile and stravaFeed.
import { getEnv } from "./env.js";

// Strava announced a Jun 2027 migration to https://www.api-v3.strava.com, but
// as of Jun 2026 that host returns 4xx for /oauth/token, /athlete, and
// /athletes/{id}/stats. Stay on the legacy base until the new host is fully
// populated; flip this single constant when revisiting before Jun 2027.
export const STRAVA_API_BASE = "https://www.strava.com/api/v3";

// Module-scoped token cache. Netlify reuses warm function instances, so this
// saves a refresh round-trip on frequent hits. esbuild inlines this module
// into each function bundle, so every function keeps its own cache instance —
// the same behaviour as the previous per-file caches.
let cachedToken = null; // { token: string, expiresAt: number }

export async function getAccessToken() {
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
