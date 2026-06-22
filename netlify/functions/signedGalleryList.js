// Private gallery listing with SIGNED Cloudinary delivery URLs.
//
// Unlike galleryList (which returns bare public_ids for PUBLIC `upload`
// assets that the browser turns into public URLs), this serves galleries
// whose assets are uploaded as `authenticated` delivery type — those can't
// be fetched by URL alone; each delivery URL needs a cryptographic
// signature. So a request without the right password gets nothing, and the
// images aren't reachable even if someone knows the cloud name + public_id.
// The password is a real gate, not a UI veil.
//
// Cost note: URL signing is a LOCAL operation (no Cloudinary API call per
// URL). One invocation lists the tag (a few paginated Admin API calls,
// memoized) and signs all ~N×3 URLs locally, returning them in one JSON
// payload. The browser then loads/downloads images straight from Cloudinary
// using those signed URLs — none of that touches Netlify. So function usage
// scales with page loads, not photo count.

import { v2 as cloudinary } from "cloudinary";
import { getEnv } from "./_shared/env.js";
import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { CLOUD_NAME, SCOPE_RE } from "./_shared/gallery.js";

// no-store: the response carries access-granting signed URLs and is only for
// an authenticated viewer — it must never sit in a shared (Cloudflare/Netlify)
// edge cache keyed by URL alone.
const jsonResponse = createJsonResponder(cacheControl.none);

// Memoize the upstream listing per tag (the contents change rarely). Signing
// is re-done per request — it's local + cheap — so memoizing the raw list is
// enough to keep Admin API calls down when the gallery is hit repeatedly.
const listMemo = createMemo(60_000);

let configured = false;
function configure(apiKey, apiSecret) {
	if (configured) return;
	cloudinary.config({ cloud_name: CLOUD_NAME, api_key: apiKey, api_secret: apiSecret, secure: true });
	configured = true;
}

// Page through the Admin search API for every AUTHENTICATED asset with this
// tag (search returns ≤500/page). Page cap is a runaway guard (12×500=6000).
async function listAuthenticated(tag, apiKey, apiSecret) {
	const auth = btoa(`${apiKey}:${apiSecret}`);
	const searchUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`;
	const out = [];
	let cursor = null;
	for (let page = 0; page < 12; page++) {
		const body = {
			expression: `tags=${tag} AND type:authenticated`,
			max_results: 500,
			with_field: ["metadata", "context", "image_metadata"],
		};
		if (cursor) body.next_cursor = cursor;
		const res = await fetch(searchUrl, {
			method: "POST",
			headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			const text = await res.text();
			console.error("Cloudinary search failed:", res.status, text);
			const e = new Error("search_failed");
			e.code = "search_failed";
			throw e;
		}
		const data = await res.json();
		out.push(...(data.resources || []));
		cursor = data.next_cursor;
		if (!cursor) break;
	}
	return out;
}

// Signed delivery URLs for the three sizes the gallery uses. Mirrors the
// public helpers in lib/cloudinary.js (thumb 800 / full 2400 / jpg download)
// but as authenticated, signed URLs. `crop: limit` avoids upscaling.
const SIGNED = { type: "authenticated", sign_url: true, secure: true };
function signedUrls(publicId) {
	return {
		thumb: cloudinary.url(publicId, { ...SIGNED, transformation: [{ fetch_format: "auto", quality: "auto", width: 800, crop: "limit" }] }),
		full: cloudinary.url(publicId, { ...SIGNED, transformation: [{ fetch_format: "auto", quality: "auto", width: 2400, crop: "limit" }] }),
		download: cloudinary.url(publicId, { ...SIGNED, transformation: [{ fetch_format: "jpg", quality: "auto:best", flags: "attachment" }] }),
	};
}

// EXIF capture time. Cloudinary's image_metadata returns EXIF dates as
// "2025:09:14 16:23:01"; normalize to a lexically-sortable, zone-less ISO
// shape ("2025-09-14T16:23:01") so plain string compare orders photos
// chronologically. Returns null when the photo carries no capture date
// (screenshots, metadata-stripped images) — the caller falls back to
// created_at (upload time) for those.
function exifCaptureDate(r) {
	const m = r.image_metadata || {};
	const raw = m.DateTimeOriginal || m.DateTimeDigitized || m.DateTime || null;
	if (!raw) return null;
	const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(raw));
	if (!match) return null;
	const [, y, mo, d, h, mi, s] = match;
	return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

function shape(resources) {
	return resources.map((r) => {
		const meta = r.metadata || {};
		const ctx = r.context?.custom || r.context || {};
		const caption = meta.caption || meta.Caption || ctx.caption || null;
		return {
			public_id: r.public_id,
			// Best chronological sort key: EXIF capture time, else upload time.
			captured_at: exifCaptureDate(r) || r.created_at,
			// display_name is the original filename (the preset sets it from
			// the upload). The client uses it for download filenames so guests
			// get "IMG_1234.jpg" instead of the unguessable public_id.
			display_name: r.display_name || null,
			width: r.width,
			height: r.height,
			created_at: r.created_at,
			caption,
			...signedUrls(r.public_id),
		};
	});
}

export default async function handler(req) {
	const url = new URL(req.url);
	const tag = (url.searchParams.get("tag") || "").toLowerCase();
	if (!SCOPE_RE.test(tag)) {
		return jsonResponse({ error: "Invalid tag" }, 400);
	}

	// Private galleries are ALWAYS gated — there is no public path here.
	// Missing env var behaves like a wrong password (don't reveal which
	// scopes exist).
	const expected = getEnv(`GALLERY_${tag.toUpperCase()}_PASSWORD`);
	const supplied = req.headers.get("x-gallery-password") || "";
	if (!expected || supplied !== expected) {
		return jsonResponse({ error: "unauthorized" }, 401);
	}

	const apiKey = getEnv("CLOUDINARY_API_KEY");
	const apiSecret = getEnv("CLOUDINARY_API_SECRET");
	if (!apiKey || !apiSecret) {
		return jsonResponse({ error: "not_configured" }, 503);
	}
	configure(apiKey, apiSecret);

	try {
		const resources = await listMemo(tag, () => listAuthenticated(tag, apiKey, apiSecret));
		return jsonResponse({ resources: shape(resources) });
	} catch (err) {
		return jsonResponse({ error: err.code || "search_failed" }, 502);
	}
}
