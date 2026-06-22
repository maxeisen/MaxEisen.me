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
// Non-fatal by design: any failure (no creds, API error) logs and exits 0 so
// the build still succeeds — the function falls back to the live search.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLOUD_NAME, SIGNED_GALLERY_TAGS, buildGalleryData } from "../netlify/functions/_shared/gallery.js";

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

async function main() {
	const { key, secret } = loadCreds();
	if (!key || !secret) {
		console.warn("[gallery-manifest] no Cloudinary creds — skipping (function will live-search)");
		return;
	}
	const auth = Buffer.from(`${key}:${secret}`).toString("base64");
	fs.mkdirSync(OUT_DIR, { recursive: true });

	for (const tag of SIGNED_GALLERY_TAGS) {
		const raw = await listAuthenticated(tag, auth);
		const { photos, people } = buildGalleryData(raw);
		photos.sort((a, b) => (a.captured_at || a.created_at || "").localeCompare(b.captured_at || b.created_at || ""));
		const outPath = path.join(OUT_DIR, `gallery-${tag}.json`);
		fs.writeFileSync(outPath, JSON.stringify({ photos, people }));
		console.log(`[gallery-manifest] ${tag}: ${photos.length} photos, ${people.length} people -> ${path.relative(ROOT, outPath)}`);
	}
}

main().catch((err) => {
	console.warn("[gallery-manifest] generation failed (non-fatal):", err.message);
	process.exit(0);
});
