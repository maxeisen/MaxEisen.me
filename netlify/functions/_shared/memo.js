// Module-scope in-memory async memoizer for Netlify functions.
//
// Netlify keeps warm function instances around between invocations, so a
// short-lived module-scope cache (the same trick as the Strava token cache)
// absorbs bursts of identical upstream calls: a CDN cold-cache moment that
// lets several requests through at once, or local `netlify dev` where there is
// no edge cache at all. esbuild inlines this module into each function bundle,
// so every function keeps its own cache instance.
//
// Keyed by an arbitrary string so a function with query variants (e.g.
// galleryList's `tag`) caches each variant separately. Concurrent callers for
// the same key share the single in-flight promise (dedupe); a rejected
// producer is never cached, so failures retry on the next request.

/**
 * @param {number} ttlMs how long a produced value stays fresh.
 * @returns {<T>(key: string, produce: () => Promise<T>) => Promise<T>}
 */
export function createMemo(ttlMs) {
	const cache = new Map(); // key -> { value, expiresAt }
	const inflight = new Map(); // key -> Promise

	return function memoize(key, produce) {
		const hit = cache.get(key);
		if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.value);

		const pending = inflight.get(key);
		if (pending) return pending;

		const p = Promise.resolve()
			.then(produce)
			.then((value) => {
				cache.set(key, { value, expiresAt: Date.now() + ttlMs });
				return value;
			})
			.finally(() => {
				inflight.delete(key);
			});
		inflight.set(key, p);
		return p;
	};
}
