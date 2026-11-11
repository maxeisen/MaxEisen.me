// Shared Strava OAuth token refresh. trainingSync is the only live caller;
// public endpoints read the snapshot it writes.
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
		throw new Error(`Strava token refresh failed: ${res.status}`);
	}
	const data = await res.json();
	cachedToken = { token: data.access_token, expiresAt: data.expires_at * 1000 };
	return cachedToken.token;
}

// Strava reports quota usage on every response, as "short,daily" pairs:
//   x-ratelimit-limit: 200,2000     x-ratelimit-usage: 12,345
// and read-only equivalents (x-readratelimit-*) covering GETs alone. The
// short window is 15 minutes. Limits differ per app and Strava has changed
// the defaults over time, so reading them beats hard-coding a guess.
function quotaPair(value) {
	const parts = String(value ?? "")
		.split(",")
		.map((n) => Number(n.trim()));
	return parts.length === 2 && parts.every(Number.isFinite) ? parts : null;
}

function spentFraction(quota) {
	const short = quota.shortLimit > 0 ? quota.shortUsage / quota.shortLimit : 0;
	const daily = quota.dailyLimit > 0 ? quota.dailyUsage / quota.dailyLimit : 0;
	return Math.max(short, daily);
}

/**
 * Read the quota headers off a Strava response.
 *
 * When both the overall and read-only buckets are present, the more depleted
 * one wins — that's the one that will start returning 429s.
 *
 * @param {Headers} headers
 * @returns {{shortUsage: number, shortLimit: number, dailyUsage: number, dailyLimit: number}|null}
 *   null when the headers are absent or malformed.
 */
export function readQuota(headers) {
	const header = (name) => headers?.get?.(name) ?? null;
	let worst = null;
	for (const prefix of ["x-ratelimit", "x-readratelimit"]) {
		const usage = quotaPair(header(`${prefix}-usage`));
		const limit = quotaPair(header(`${prefix}-limit`));
		if (!usage || !limit) continue;
		const quota = {
			shortUsage: usage[0],
			shortLimit: limit[0],
			dailyUsage: usage[1],
			dailyLimit: limit[1],
		};
		if (!worst || spentFraction(quota) > spentFraction(worst)) worst = quota;
	}
	return worst;
}

/**
 * How many more requests a caller may make against the quota it last observed.
 *
 * The shares exist because one Strava app backs several endpoints here — the
 * /running sync is a background job and must leave room for the /dashboard
 * widgets, which are in a visitor's request path.
 *
 * @param {object|null} quota from readQuota(); null before the first response.
 * @param {{shortShare?: number, dailyShare?: number}} [options]
 * @returns {number} Infinity when no quota has been observed, so callers fall
 *   back to whatever budget they set for themselves.
 */
export function callsRemaining(quota, { shortShare = 1, dailyShare = 1 } = {}) {
	if (!quota) return Infinity;
	const short =
		quota.shortLimit > 0 ? Math.floor(quota.shortLimit * shortShare) - quota.shortUsage : Infinity;
	const daily =
		quota.dailyLimit > 0 ? Math.floor(quota.dailyLimit * dailyShare) - quota.dailyUsage : Infinity;
	return Math.max(0, Math.min(short, daily));
}

// Strava's windows are clock-aligned, not sliding: 15-minute buckets reset at
// :00/:15/:30/:45, and the daily bucket at midnight UTC. Waiting "15 minutes
// from now" retries inside the same window; those 429s still count, which is
// how a short overage becomes a blown day.
function nextQuarterHour(now) {
	const d = new Date(now);
	const next = Math.floor(d.getUTCMinutes() / 15) * 15 + 15;
	d.setUTCSeconds(0, 0);
	d.setUTCMinutes(next);
	return d.getTime();
}

function nextUtcMidnight(now) {
	const d = new Date(now);
	d.setUTCHours(24, 0, 0, 0);
	return d.getTime();
}

/**
 * When the next request at this quota is allowed, given a 429's headers.
 *
 * Daily exhaustion waits for midnight UTC; a short-window 429 (or a 429 with
 * no headers at all) waits for the next quarter hour. Retry-After wins when
 * it is later than that.
 *
 * @param {object|null} quota from readQuota()
 * @param {{now?: number, retryAfterSec?: number|null}} [options]
 * @returns {number} epoch ms
 */
export function cooldownUntil(quota, { now = Date.now(), retryAfterSec = null } = {}) {
	const dailyBlown = quota?.dailyLimit > 0 && quota.dailyUsage >= quota.dailyLimit;
	const computed = dailyBlown ? nextUtcMidnight(now) : nextQuarterHour(now);
	const retry =
		retryAfterSec != null && Number.isFinite(retryAfterSec) ? now + retryAfterSec * 1000 : 0;
	return Math.max(computed, retry);
}

// Process-local stand-down. Each function bundle gets its own copy, which is
// enough to absorb retries against a warm instance (the dashboard poll, a CDN
// miss burst). trainingSync also persists the timestamp on its cursor so a
// cold start five minutes later does not poke Strava again.
let coolUntil = 0;

export function isCoolingDown(now = Date.now()) {
	return now < coolUntil;
}

export function cooldownExpiresAt() {
	return coolUntil;
}

/**
 * Record a 429. Subsequent isCoolingDown() calls stay true until the window
 * the headers describe, so callers can fail without spending another request.
 *
 * @param {Headers} headers
 * @param {number} [now]
 * @returns {number} epoch ms the cooldown expires
 */
export function noteRateLimit(headers, now = Date.now()) {
	const retryAfter = Number(headers?.get?.("retry-after"));
	const until = cooldownUntil(readQuota(headers), {
		now,
		retryAfterSec: Number.isFinite(retryAfter) ? retryAfter : null,
	});
	if (until > coolUntil) coolUntil = until;
	return coolUntil;
}

function standDown(message, overShare) {
	const err = new Error(message);
	// A 429 to every caller, so "stop asking" is one check whichever of the
	// two said it. `overShare` tells apart this job stopping at its own share
	// (nothing was sent) from Strava refusing a call (one was).
	err.status = 429;
	err.overShare = overShare;
	return err;
}

/**
 * A Strava session for one job that spends a share of the app's rate limit.
 *
 * One app's credentials serve several endpoints, and some of them are in a
 * visitor's request path, so a background job has to stop short of the limit
 * rather than at it. The client owns that: it reads the quota off every
 * response, and every call it makes first checks the share and any 429
 * cooldown. Nothing is sent once either says stop; the call throws a 429 with
 * `overShare` set when it was the share.
 *
 * Quota is per client. Create one per invocation: a reading left over from a
 * warm instance describes a window that has almost certainly rolled over.
 *
 * @param {object} input
 * @param {string} input.token access token.
 * @param {{shortShare?: number, dailyShare?: number}} [input.share]
 * @param {typeof fetch} [input.fetch] the HTTP adapter; defaults to the global.
 * @returns {{
 *   get: (path: string) => Promise<any>,
 *   put: (path: string, body: object) => Promise<any>,
 *   canSpend: (calls?: number) => boolean,
 *   reserve: (calls?: number) => void,
 *   coolingDown: () => boolean,
 *   cooldownUntil: () => string|null,
 * }}
 */
export function createStravaClient({ token, share = {}, fetch: send = (...args) => globalThis.fetch(...args) }) {
	// null until the first response; callsRemaining reads that as no bound.
	let quota = null;

	function canSpend(calls = 1) {
		return !isCoolingDown() && callsRemaining(quota, share) >= calls;
	}

	// Throw unless `calls` more requests fit. For a step that needs several
	// calls to be worth anything, so it doesn't spend the first and strand it.
	function reserve(calls = 1) {
		if (isCoolingDown()) throw standDown("Strava is cooling down after a 429", false);
		if (callsRemaining(quota, share) < calls) throw standDown("Strava share spent", true);
	}

	async function request(method, path, body) {
		reserve(1);
		const init = { headers: { Authorization: `Bearer ${token}` } };
		if (method !== "GET") {
			init.method = method;
			init.headers["Content-Type"] = "application/json";
			init.body = JSON.stringify(body);
		}
		const res = await send(`${STRAVA_API_BASE}${path}`, init);
		// Errors too: a 429 carries the headers that say how far over we are.
		quota = readQuota(res.headers) ?? quota;
		if (!res.ok) {
			if (res.status === 429) noteRateLimit(res.headers);
			const text = method === "GET" ? "" : await res.text();
			const err = new Error(`Strava ${method} ${path} failed: ${res.status}${text ? ` ${text}` : ""}`);
			err.status = res.status;
			if (text) err.body = text;
			throw err;
		}
		return res.json();
	}

	return {
		get: (path) => request("GET", path),
		put: (path, body) => request("PUT", path, body),
		canSpend,
		reserve,
		coolingDown: () => isCoolingDown(),
		// For persisting across cold starts: the cooldown's end, while it's ahead.
		cooldownUntil: () => {
			const until = cooldownExpiresAt();
			return until > Date.now() ? new Date(until).toISOString() : null;
		},
	};
}

/**
 * Refresh the token and open a client on it.
 *
 * @param {{share?: object, fetch?: typeof fetch}} [options]
 * @throws {Error} code "not_configured" when the Strava env vars are missing.
 */
export async function openStravaClient(options = {}) {
	return createStravaClient({ ...options, token: await getAccessToken() });
}

export function rateLimitCacheHeaders(now = Date.now()) {
	const retryAfter = Math.max(1, Math.ceil((coolUntil - now) / 1000));
	return {
		"Cache-Control": `public, max-age=${retryAfter}`,
		"Retry-After": String(retryAfter),
	};
}
