// Precompute the listing for each signed (authenticated) gallery into a
// manifest the signedGalleryList function reads at request time.
//
// Why: the Cloudinary Admin search for a 1000+ photo gallery takes ~20s
// because it streams every asset's metadata. Running that per page load made
// cold loads crawl. The asset list only changes when photos are added, so we
// resolve it once here (at build time, which has Cloudinary creds) and write a
// lean, URL-free JSON. The function then just mints signed URLs locally.
//
// Output: netlify/functions/_generated/gallery-<tag>.json  (gitignored — the
// repo is public and these carry filenames/timestamps). Regenerated on every
// deploy; run `npm run gallery:manifest` locally to refresh it for dev.
//
// Failure modes:
//   - No creds / API/network error → non-fatal, exit 0; the function falls
//     back to the live Admin search at request time.
//   - People list incomplete (someone tagged face:<slug> has no definition)
//     → retry (Cloudinary's search index is eventually-consistent and may lag
//     a just-written context); if still short after retries, FAIL the build
//     (exit 1) so the previous complete deploy stays live rather than shipping
//     a gallery missing a filter chip.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLOUD_NAME, SIGNED_GALLERY_TAGS, buildGalleryData, faceSlugs } from "../netlify/functions/_shared/gallery.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const OUT_DIR = path.join(ROOT, "netlify/functions/_generated");

// Creds: Netlify build env first, else a local .env (KEY=VALUE per line).
function loadCreds() {
	let { CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
	if ((!key || !secret) && fs.existsSync(path.join(ROOT, ".env"))) {
		for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
			const i = line.indexOf("=");
			if (i < 0) continue;
			const k = line.slice(0, i).trim();
			const v = line.slice(i + 1).trim();
			if (k === "CLOUDINARY_API_KEY" && !key) key = v;
			if (k === "CLOUDINARY_API_SECRET" && !secret) secret = v;
		}
	}
	return { key, secret };
}

async function listAuthenticated(tag, auth) {
	const searchUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`;
	const out = [];
	let cursor = null;
	for (let page = 0; page < 12; page++) {
		const body = { expression: `tags=${tag} AND type:authenticated`, max_results: 500, with_field: ["metadata", "context", "image_metadata", "tags"] };
		if (cursor) body.next_cursor = cursor;
		const res = await fetch(searchUrl, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
		if (!res.ok) throw new Error(`search ${tag} failed: ${res.status} ${await res.text()}`);
		const data = await res.json();
		out.push(...(data.resources || []));
		cursor = data.next_cursor;
		if (!cursor) break;
	}
	return out;
}

// Build one tag's data, retrying while the search index lags behind a recent
// context write (every person tagged face:<slug> should have a definition).
async function buildTag(tag, auth) {
	let last;
	for (let attempt = 1; attempt <= 4; attempt++) {
		const raw = await listAuthenticated(tag, auth);
		const data = buildGalleryData(raw);
		const tagged = new Set(raw.flatMap(faceSlugs));
		const defined = new Set(data.people.map((p) => p.slug));
		const missing = [...tagged].filter((s) => !defined.has(s));
		last = { data, missing };
		if (!missing.length) return data;
		console.warn(`[gallery-manifest] ${tag}: ${missing.length} tagged people missing definitions (${missing.join(", ")}); index settling, retry ${attempt}/4…`);
		await sleep(8000);
	}
	throw Object.assign(new Error(`${tag}: ${last.missing.length} people still missing after retries (${last.missing.join(", ")})`), { fatal: true });
}

async function main() {
	const { key, secret } = loadCreds();
	if (!key || !secret) {
		console.warn("[gallery-manifest] no Cloudinary creds — skipping (function will live-search)");
		return;
	}
	const auth = Buffer.from(`${key}:${secret}`).toString("base64");
	fs.mkdirSync(OUT_DIR, { recursive: true });

	for (const tag of SIGNED_GALLERY_TAGS) {
		const { photos, people } = await buildTag(tag, auth);
		photos.sort((a, b) => (a.captured_at || a.created_at || "").localeCompare(b.captured_at || b.created_at || ""));
		const outPath = path.join(OUT_DIR, `gallery-${tag}.json`);
		fs.writeFileSync(outPath, JSON.stringify({ photos, people }));
		console.log(`[gallery-manifest] ${tag}: ${photos.length} photos, ${people.length} people -> ${path.relative(ROOT, outPath)}`);
	}
}

main().catch((err) => {
	if (err.fatal) {
		// Incomplete people list → fail the build; keep the last good deploy.
		console.error("[gallery-manifest] FATAL:", err.message);
		process.exit(1);
	}
	// Network / API / creds issue → non-fatal; function live-searches at runtime.
	console.warn("[gallery-manifest] generation failed (non-fatal):", err.message);
	process.exit(0);
});
