// In-memory stale-while-revalidate cache for client-side JSON GETs.
//
// Why: the dashboard mounts ~7 widgets that each fetch on mount; navigating
// away and back re-mounts them all and re-fires the whole burst. This cache
// lets a re-mount serve the last value *instantly* (no spinner, no network)
// while a background revalidation refreshes it, and collapses concurrent
// callers for the same URL into a single in-flight request (dedupe).
//
// Scope: per page load (module memory). Not persisted — a hard reload starts
// cold, which is the intended freshness boundary. Pair with a `maxAgeMs` below
// the caller's poll interval so scheduled polls still revalidate on cadence
// while re-mounts inside the window stay free.

import { fetchJson } from "./fetchJson.js";

const cache = new Map(); // url -> { value, ts }
const inflight = new Map(); // url -> Promise<value>

const DEFAULT_MAX_AGE_MS = 60_000;

// Test/debug helpers — not used by app code.
export function swrPeek(url) {
	return cache.get(url);
}
export function swrClear() {
	cache.clear();
	inflight.clear();
}

function revalidate(url, fetchOptions) {
	// Share a single network request among concurrent callers for this url.
	const pending = inflight.get(url);
	if (pending) return pending;
	const p = fetchJson(url, fetchOptions)
		.then((value) => {
			cache.set(url, { value, ts: Date.now() });
			return value;
		})
		.finally(() => {
			inflight.delete(url);
		});
	inflight.set(url, p);
	return p;
}

/**
 * Stale-while-revalidate JSON fetch.
 *
 * - Fresh hit (age < maxAgeMs): resolves with the cached value, no network.
 * - Stale hit: resolves *immediately* with the cached value AND kicks off a
 *   background revalidation. `onRevalidate(value)` fires when the refreshed
 *   value lands; background errors are swallowed so the stale value survives a
 *   transient upstream failure.
 * - Miss: awaits the network, exactly like a plain `fetchJson` (errors, incl.
 *   `FetchError`, propagate so callers can branch on `.status`).
 * - Concurrent callers for the same url share one in-flight request.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.maxAgeMs]
 * @param {(value: any) => void} [opts.onRevalidate]
 * @param {RequestInit} [opts.fetchOptions] forwarded to fetchJson.
 * @returns {Promise<any>}
 */
export async function fetchJsonSwr(url, opts = {}) {
	const { maxAgeMs = DEFAULT_MAX_AGE_MS, onRevalidate, fetchOptions } = opts;
	const entry = cache.get(url);

	if (entry) {
		const fresh = Date.now() - entry.ts < maxAgeMs;
		if (!fresh) {
			revalidate(url, fetchOptions)
				.then((value) => onRevalidate?.(value))
				.catch(() => {});
		}
		return entry.value;
	}

	return revalidate(url, fetchOptions);
}
