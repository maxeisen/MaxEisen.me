#!/usr/bin/env node
// One-shot importer for Google Takeout → Toronto map pins.
//
// Reads Reviews.json from a Takeout export, filters to high-rated GTA
// places, and writes a curation-ready pin list to
// public/content/toronto.json. The schema includes a few fields that
// are intentionally blank (category, notes, photo) for hand-curation,
// plus the original review text under _review as a reference. Re-running
// the script preserves existing curated pins by id; only adds new ones.
//
// Usage:
//   node scripts/import-google-takeout.mjs path/to/Takeout
//
// (Defaults to ~/Downloads/Takeout if no path given.)

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
// Imports land in a gitignored staging file, NOT the live data file —
// the raw review text includes personal context (wedding vendors,
// referenced names, etc.) that shouldn't ship to prod. Curate manually
// from staging → public/content/toronto.json, rewriting notes in your
// own voice as you go.
const OUT_PATH = join(REPO_ROOT, "scripts", "toronto-staging.json");

const takeoutRoot = process.argv[2] || join(homedir(), "Downloads", "Takeout");
const reviewsPath = join(takeoutRoot, "Maps (your places)", "Reviews.json");

if (!existsSync(reviewsPath)) {
	console.error(`Couldn't find ${reviewsPath}`);
	process.exit(1);
}

// Greater Toronto Area bounding box.
const GTA = { latMin: 43.4, latMax: 43.95, lngMin: -79.7, lngMax: -79.0 };
const MIN_RATING = 4;

const inGTA = (lat, lng) =>
	lat >= GTA.latMin && lat <= GTA.latMax && lng >= GTA.lngMin && lng <= GTA.lngMax;

// Stable id derived from name + a slice of the google_maps_url (which
// embeds a Google Place ID). Stays stable across re-imports so we can
// merge with hand-curated edits.
function pinId(name, url) {
	const slug = String(name || "place")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
	const placeIdMatch = String(url || "").match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/);
	const placeHash = placeIdMatch
		? placeIdMatch[1].split(":")[1].slice(2, 10)
		: Math.random().toString(36).slice(2, 10);
	return `${slug}-${placeHash}`;
}

const raw = JSON.parse(await readFile(reviewsPath, "utf8"));

const candidates = (raw.features || [])
	.filter((f) => {
		const [lng, lat] = f.geometry?.coordinates || [];
		const rating = f.properties?.five_star_rating_published || 0;
		return lng != null && lat != null && inGTA(lat, lng) && rating >= MIN_RATING;
	})
	.map((f) => {
		const [lng, lat] = f.geometry.coordinates;
		const p = f.properties;
		return {
			id: pinId(p.location?.name, p.google_maps_url),
			name: p.location?.name || "(unnamed)",
			lat,
			lng,
			category: null,           // pick from: coffee | eat | drink | ride | run | shoot | view | hidden
			notes: "",                // your voice — short, evocative, 1–2 sentences
			photo: null,              // Cloudinary public_id (optional)
			published: false,         // flip true when ready
			address: p.location?.address || null,
			googleMapsUrl: p.google_maps_url || null,
			_review: p.review_text_published || null,  // reference only; rewrite into `notes`
			_rating: p.five_star_rating_published,
			_importedAt: p.date || null,
		};
	})
	.sort((a, b) => (b._rating || 0) - (a._rating || 0));

// Preserve curated edits across re-runs.
let existing = [];
if (existsSync(OUT_PATH)) {
	try {
		existing = JSON.parse(await readFile(OUT_PATH, "utf8"));
		if (!Array.isArray(existing)) existing = [];
	} catch {}
}
const existingById = new Map(existing.map((p) => [p.id, p]));

const merged = [];
for (const c of candidates) {
	if (existingById.has(c.id)) {
		// Already curated — keep the curated record verbatim, just refresh
		// fields that come from the source of truth (review text, rating).
		const prev = existingById.get(c.id);
		merged.push({ ...prev, _review: c._review, _rating: c._rating });
		existingById.delete(c.id);
	} else {
		merged.push(c);
	}
}
// Append any hand-added pins that aren't in the import set (e.g., spots
// without a Google review).
for (const stray of existingById.values()) merged.push(stray);

await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + "\n");

const newCount = merged.length - existing.length;
console.log(`Wrote ${merged.length} pins to ${OUT_PATH}`);
console.log(`  imported: ${candidates.length} candidates (rating ≥ ${MIN_RATING}, within GTA)`);
console.log(`  preserved curated: ${existing.length}`);
console.log(`  newly added this run: ${newCount > 0 ? newCount : 0}`);
