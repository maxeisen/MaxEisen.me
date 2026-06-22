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
// Speed: the Cloudinary Admin search for a 1000+ photo gallery takes ~20s
// (it streams every asset's metadata), which made a cold page load crawl.
// Since signed galleries don't change between deploys, the asset list is
// precomputed into a build-time manifest (scripts/build-gallery-manifest.mjs)
// that this function reads instantly; it only mints the (non-expiring) signed
// URLs per request, which is a fast local crypto op. If the manifest is
// missing (e.g. generation was skipped), it falls back to the live search.
//
// Cost note: signing is LOCAL (no Cloudinary call per URL); the browser then
// loads/downloads images straight from Cloudinary. Function usage scales with
// page loads, not photo count — and most repeat loads are served from the
// browser's private cache (see cacheControl.privateBrowser).

import { readFileSync } from "node:fs";
import { v2 as cloudinary } from "cloudinary";
import { getEnv } from "./_shared/env.js";
import { createJsonResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { CLOUD_NAME, SCOPE_RE, buildGalleryData } from "./_shared/gallery.js";

// Success: per-viewer browser cache (10 min) so a returning authed browser
// reuses the list without re-hitting the function. Errors/gate failures are
// never cached.
const okResponse = createJsonResponder(cacheControl.privateBrowser(600));
const errResponse = createJsonResponder(cacheControl.none);

// Fallback live-listing memo (only used when the manifest is absent).
const listMemo = createMemo(60_000);

// Build-time manifests. Static `new URL(...)` so Netlify's bundler traces and
// bundles the file; a missing/empty file yields null and we fall back to the
// live search. Reading the precomputed list is what makes the load instant.
const MANIFEST_URLS = {
	wedding: new URL("./_generated/gallery-wedding.json", import.meta.url),
};
function loadManifest(tag) {
	const u = MANIFEST_URLS[tag];
	if (!u) return null;
	try {
		const data = JSON.parse(readFileSync(u, "utf8"));
		// New shape {photos, people}; tolerate a legacy bare-array manifest.
		if (Array.isArray(data)) return data.length ? { photos: data, people: [] } : null;
		return data.photos?.length ? { photos: data.photos, people: data.people || [] } : null;
	} catch {
		return null;
	}
}

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
			with_field: ["metadata", "context", "image_metadata", "tags"],
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
function withSignedUrls(entry) {
	// Download: bounded to 2400px @ q_85 jpg with fl_keep_iptc so the file
	// retains its embedded EXIF/IPTC/XMP metadata (incl. capture date) while
	// staying ~0.8 MB instead of the multi-MB original — roughly 1/8th the
	// delivery bandwidth, which matters on a metered Cloudinary plan. A plain
	// transformed delivery would strip all metadata; q_auto is incompatible
	// with keep_iptc (Cloudinary rejects it), so quality is fixed. fl_attachment
	// forces the download and carries a readable filename (URL-safe-sanitized).
	const { public_id, display_name } = entry;
	const safeName = display_name ? String(display_name).replace(/[^a-zA-Z0-9_-]+/g, "_") : "";
	const attach = safeName ? `attachment:${safeName}` : "attachment";
	return {
		...entry,
		thumb: cloudinary.url(public_id, { ...SIGNED, transformation: [{ fetch_format: "auto", quality: "auto", width: 800, crop: "limit" }] }),
		full: cloudinary.url(public_id, { ...SIGNED, transformation: [{ fetch_format: "auto", quality: "auto", width: 2400, crop: "limit" }] }),
		download: cloudinary.url(public_id, { ...SIGNED, transformation: [{ width: 2400, crop: "limit", quality: 85, fetch_format: "jpg", flags: ["keep_iptc", attach] }] }),
	};
}

// Signed, face-cropped chip for a person. Crops to their stored fractional
// face box (with margin) on their representative photo; if no box is stored,
// falls back to Cloudinary face-gravity cropping.
function signPerson(p) {
	let transformation;
	if (Array.isArray(p.box) && p.box.length === 4) {
		const [x, y, w, h] = p.box;
		const m = 0.4; // breathing room around the face
		const nx = Math.max(0, x - w * m);
		const ny = Math.max(0, y - h * m);
		const nw = Math.min(1 - nx, w * (1 + 2 * m));
		const nh = Math.min(1 - ny, h * (1 + 2 * m));
		const r = (n) => Math.round(n * 10000) / 10000;
		transformation = [
			{ crop: "crop", x: r(nx), y: r(ny), width: r(nw), height: r(nh) },
			{ width: 160, height: 160, crop: "fill", gravity: "auto", fetch_format: "auto", quality: "auto" },
		];
	} else {
		transformation = [{ gravity: "face", crop: "thumb", width: 160, height: 160, fetch_format: "auto", quality: "auto" }];
	}
	return { slug: p.slug, name: p.name, count: p.count, chip: cloudinary.url(p.repPublicId, { ...SIGNED, transformation }) };
}

export default async function handler(req) {
	const url = new URL(req.url);
	const tag = (url.searchParams.get("tag") || "").toLowerCase();
	if (!SCOPE_RE.test(tag)) {
		return errResponse({ error: "Invalid tag" }, 400);
	}

	// Private galleries are ALWAYS gated — there is no public path here.
	// Missing env var behaves like a wrong password (don't reveal which
	// scopes exist).
	const expected = getEnv(`GALLERY_${tag.toUpperCase()}_PASSWORD`);
	const supplied = req.headers.get("x-gallery-password") || "";
	if (!expected || supplied !== expected) {
		return errResponse({ error: "unauthorized" }, 401);
	}

	const apiKey = getEnv("CLOUDINARY_API_KEY");
	const apiSecret = getEnv("CLOUDINARY_API_SECRET");
	if (!apiKey || !apiSecret) {
		return errResponse({ error: "not_configured" }, 503);
	}
	configure(apiKey, apiSecret);

	try {
		// Fast path: precomputed manifest. Fallback: live Admin search.
		let data = loadManifest(tag);
		if (!data) {
			const raw = await listMemo(tag, () => listAuthenticated(tag, apiKey, apiSecret));
			data = buildGalleryData(raw);
		}
		return okResponse({
			resources: data.photos.map(withSignedUrls),
			people: data.people.map(signPerson),
		});
	} catch (err) {
		return errResponse({ error: err.code || "search_failed" }, 502);
	}
}
