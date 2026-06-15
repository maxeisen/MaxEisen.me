import { getEnv } from "./_shared/env.js";
import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { CLOUD_NAME, SCOPE_RE } from "./_shared/gallery.js";

const jsonResponse = createJsonResponder(cacheControl.swr(300, 900));

// Scopes served without a password. Kept as an explicit allow-list so
// accidentally omitting GALLERY_<SCOPE>_PASSWORD can't silently make a
// gallery public — the default for any unknown scope is "gated."
const PUBLIC_SCOPES = new Set(["gallery"]);

// Memoize the upstream search per tag. Gallery contents change rarely; this
// absorbs bursts past the CDN's 5-min edge cache without serving staler data.
const memo = createMemo(60_000);

// Run the Cloudinary search and shape the result. Throws an Error tagged with
// `.code` ("request_failed" | "search_failed") on upstream failure.
async function fetchGallery(tag, apiKey, apiSecret) {
	const auth = btoa(`${apiKey}:${apiSecret}`);
	const searchUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`;
	const body = {
		expression: `tags=${tag}`,
		max_results: 500,
		with_field: ["metadata", "context"],
	};

	let res;
	try {
		res = await fetch(searchUrl, {
			method: "POST",
			headers: {
				"Authorization": `Basic ${auth}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});
	} catch (err) {
		console.error("Cloudinary search request failed:", err.message);
		const e = new Error("request_failed");
		e.code = "request_failed";
		throw e;
	}

	if (!res.ok) {
		const text = await res.text();
		console.error("Cloudinary search failed:", res.status, text);
		const e = new Error("search_failed");
		e.code = "search_failed";
		throw e;
	}

	const data = await res.json();
	const resources = (data.resources || []).map((r) => {
		const meta = r.metadata || {};
		const ctx = r.context?.custom || r.context || {};
		// `caption` is the structured-metadata field used across all galleries
		// (renamed from `location` so it can hold anything — a place, a title,
		// or just a description). Older photos that still have `location`
		// populated fall through as a backstop.
		const caption = meta.caption || meta.Caption || ctx.caption
			|| meta.location || meta.Location || ctx.location
			|| null;
		const uploader = meta.uploader || meta.Uploader || ctx.uploader || null;
		return {
			public_id: r.public_id,
			format: r.format,
			width: r.width,
			height: r.height,
			created_at: r.created_at,
			caption,
			uploader,
		};
	});

	return { resources };
}

export default async function handler(req) {
	const url = new URL(req.url);
	const tag = (url.searchParams.get("tag") || "gallery").toLowerCase();
	if (!SCOPE_RE.test(tag)) {
		return jsonResponse({ error: "Invalid tag" }, 400, { "Cache-Control": "no-store" });
	}

	// Gate protected tags behind the password header. Don't cache an
	// unauthorized response — different viewers may have different rights.
	if (!PUBLIC_SCOPES.has(tag)) {
		const expected = getEnv(`GALLERY_${tag.toUpperCase()}_PASSWORD`);
		const supplied = req.headers.get("x-gallery-password") || "";
		// Missing env var → behave the same as a wrong password. Don't tell
		// clients which scopes are real on this deployment.
		if (!expected || supplied !== expected) {
			return jsonResponse({ error: "unauthorized" }, 401, { "Cache-Control": "no-store" });
		}
	}

	const apiKey = getEnv("CLOUDINARY_API_KEY");
	const apiSecret = getEnv("CLOUDINARY_API_SECRET");
	if (!apiKey || !apiSecret) {
		return jsonResponse({ error: "not_configured" }, 503);
	}

	try {
		const payload = await memo(tag, () => fetchGallery(tag, apiKey, apiSecret));
		return jsonResponse(payload);
	} catch (err) {
		return jsonResponse({ error: err.code || "search_failed" }, 502);
	}
}
