// Shared JSON response builder + cache-control presets for the Netlify
// functions. Each function declares its caching intent once via
// createJsonResponder(...) and then calls the returned helper exactly like the
// old per-file jsonResponse (body, status, extraHeaders).

// Named cache-control presets so each function states its intent by meaning
// rather than re-typing the header string. `swr`/`edgeBurst` take seconds.
export const cacheControl = {
	// Never store: auth checks, signing, mutations, per-viewer reads.
	none: { "Cache-Control": "no-store" },
	// Public browser + CDN cache with stale-while-revalidate.
	swr: (maxAge, staleWhileRevalidate) => ({
		"Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
	}),
	// Browser always revalidates (max-age=0); Netlify's edge caches briefly to
	// dedupe concurrent polls without letting data go more than `edgeMaxAge`s
	// stale.
	edgeBurst: (edgeMaxAge) => ({
		"Cache-Control": "private, max-age=0, must-revalidate",
		"Netlify-CDN-Cache-Control": `public, max-age=${edgeMaxAge}`,
	}),
};

// Build a jsonResponse bound to a function's default headers (its caching
// intent). Per-call `extraHeaders` override the defaults, preserving the old
// helpers' (body, status = 200, extraHeaders = {}) signature and the
// behaviour where a call site can swap in `no-store` for error responses.
export function createJsonResponder(defaultHeaders = {}) {
	return function jsonResponse(body, status = 200, extraHeaders = {}) {
		return new Response(JSON.stringify(body), {
			status,
			headers: {
				"Content-Type": "application/json",
				...defaultHeaders,
				...extraHeaders,
			},
		});
	};
}
