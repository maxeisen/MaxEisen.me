// Oura Cloud API access for the recovery half of /training.
//
// The awkward part here isn't the API, it's the tokens. Personal access tokens
// were withdrawn at the end of 2025, so this is OAuth2 authorization-code only,
// and Oura's refresh tokens are single-use: refreshing returns a new pair and
// invalidates the one just spent. Strava and Spotify both hand back a refresh
// token that keeps working, which is why those integrations can read one out of
// an environment variable and never think about it again (see strava.js). Do
// that here and the second refresh fails.
//
// So Oura's token state lives in Blobs and is written back on every rotation.
// Two consequences worth knowing before changing anything below:
//
//   - The write has to happen before the token is handed out. A token used but
//     never stored leaves the successor lost, and the only fix is a human
//     re-authorising the app.
//   - OURA_REFRESH_TOKEN is a bootstrap, not the live credential. It seeds the
//     very first refresh, and is retried if the stored chain ever breaks, which
//     makes recovery "paste a fresh token into the env var" rather than "change
//     the code". Once stored state exists the variable is otherwise unused.
//
// Rate limits are a non-issue: 5000 requests per 5 minutes, against the handful
// a day this makes. None of the Strava quota accounting has an equivalent here.

import { getEnv } from "./env.js";
import { OURA_KEY, readJson, writeJson } from "./training/store.js";

export const OURA_API_BASE = "https://api.ouraring.com";

// Refresh this far before expiry rather than on it. Oura access tokens last a
// day, so this costs nothing and avoids racing the clock mid-sync.
const EXPIRY_MARGIN_MS = 5 * 60_000;

/** Thrown when there's nothing to authenticate with, matching strava.js. */
function notConfigured(message) {
	const err = new Error(message);
	err.code = "not_configured";
	return err;
}

/**
 * Exchange a refresh token for a new pair.
 *
 * @param {string} refreshToken
 * @param {{clientId: string, clientSecret: string}} credentials
 * @returns {Promise<{accessToken: string, refreshToken: string, expiresAt: number}>}
 */
async function exchange(refreshToken, { clientId, clientSecret }) {
	const res = await fetch(`${OURA_API_BASE}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: clientId,
			client_secret: clientSecret,
		}),
	});
	if (!res.ok) {
		const err = new Error(`Oura token refresh failed: ${res.status}`);
		err.status = res.status;
		throw err;
	}
	const data = await res.json();
	if (!data?.access_token || !data?.refresh_token) {
		throw new Error("Oura token refresh returned no token");
	}
	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		// expires_in is seconds from now. Stored absolute so a warm function
		// instance can read it without knowing when it was issued.
		expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
	};
}

/**
 * A usable Oura access token, refreshing and persisting as needed.
 *
 * @param {object} store the training Blobs store.
 * @returns {Promise<string>}
 * @throws {Error} with code "not_configured" when credentials are absent, so
 *   callers can tell "no Oura set up" apart from "Oura is broken".
 */
export async function getOuraAccessToken(store) {
	const clientId = getEnv("OURA_CLIENT_ID");
	const clientSecret = getEnv("OURA_CLIENT_SECRET");
	if (!clientId || !clientSecret) throw notConfigured("Oura client credentials missing");

	const stored = await readJson(store, OURA_KEY, null);
	if (stored?.accessToken && Number(stored.expiresAt) > Date.now() + EXPIRY_MARGIN_MS) {
		return stored.accessToken;
	}

	const bootstrap = getEnv("OURA_REFRESH_TOKEN");
	if (!stored?.refreshToken && !bootstrap) throw notConfigured("Oura refresh token missing");

	const credentials = { clientId, clientSecret };
	let next;
	try {
		next = await exchange(stored?.refreshToken || bootstrap, credentials);
	} catch (err) {
		// The stored chain is broken: either a rotation was lost, or the app
		// was re-authorised elsewhere and this token was superseded. Falling
		// back to the environment is what makes that recoverable without a
		// deploy — and it's only worth trying if it's a different token.
		const canRetry = stored?.refreshToken && bootstrap && bootstrap !== stored.refreshToken;
		if (!canRetry) throw err;
		console.warn("Oura stored refresh token rejected, falling back to OURA_REFRESH_TOKEN");
		next = await exchange(bootstrap, credentials);
	}

	// Before returning it, not after. If this write fails the successor is
	// gone, and continuing would spend a token nothing can follow.
	await writeJson(store, OURA_KEY, { ...next, updatedAt: new Date().toISOString() });
	return next.accessToken;
}

/**
 * GET an Oura endpoint.
 *
 * @param {string} path e.g. "/v2/usercollection/daily_sleep".
 * @param {string} token
 * @param {object} [params] query parameters, undefined values dropped.
 * @returns {Promise<object>}
 */
export async function ouraGet(path, token, params = {}) {
	const query = new URLSearchParams(
		Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
	);
	const url = `${OURA_API_BASE}${path}${query.size ? `?${query}` : ""}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
	if (!res.ok) {
		// 403 is its own thing here: Oura returns it when the membership has
		// lapsed, and the data simply stops rather than the app being wrong.
		const err = new Error(`Oura ${path} failed: ${res.status}`);
		err.status = res.status;
		throw err;
	}
	return res.json();
}

/**
 * Every document from a paginated collection between two days, inclusive.
 *
 * @param {string} path
 * @param {string} token
 * @param {{start: string, end: string}} range day keys.
 * @returns {Promise<object[]>}
 */
export async function ouraCollection(path, token, { start, end }) {
	const out = [];
	let nextToken;
	// Bounded rather than while(true): a paging bug upstream shouldn't be able
	// to spin a scheduled function until it's killed. A training block is a few
	// hundred documents at most, well inside this.
	for (let page = 0; page < 10; page++) {
		const body = await ouraGet(path, token, {
			"start_date": start,
			"end_date": end,
			"next_token": nextToken,
		});
		for (const doc of body?.data || []) out.push(doc);
		nextToken = body?.next_token || undefined;
		if (!nextToken) break;
	}
	return out;
}
