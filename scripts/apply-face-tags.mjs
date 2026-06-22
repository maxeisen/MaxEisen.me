// Apply the face-clustering result to Cloudinary (one-time, local).
//
// Reads the local clustering output + your names, drops anyone marked DROP,
// and writes the result back to Cloudinary so the build can pick it up:
//   - tags each photo `face:<slug>` for every named person in it (batched)
//   - uploads a PRIVATE (authenticated) raw JSON index mapping slug -> name,
//     representative photo + face box, and photo count
//
// Nothing sensitive lands in the public repo. Re-runnable. Reads creds from
// process.env or a local .env.
//
//   node scripts/apply-face-tags.mjs            # apply
//   node scripts/apply-face-tags.mjs --dry-run  # preview only

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

const CLOUD = "meisen-gallery";
const TAG = "wedding";                       // gallery tag the photos already carry
const BASE = path.join(os.homedir(), "Downloads/wedding-face-clusters");
const CLUSTERS = [
	path.join(BASE, "clusters.json"),
	path.join(BASE, "photo_face_labelling/clusters.json"),
].find((p) => fs.existsSync(p)) || path.join(BASE, "clusters.json");
const NAMES = path.join(BASE, "names-template.txt");
const DRY = process.argv.includes("--dry-run");

function loadCreds() {
	let { CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
	const envPath = path.resolve(".env");
	if ((!key || !secret) && fs.existsSync(envPath)) {
		for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
			const i = line.indexOf("=");
			if (i < 0) continue;
			const k = line.slice(0, i).trim(), v = line.slice(i + 1).trim();
			if (k === "CLOUDINARY_API_KEY" && !key) key = v;
			if (k === "CLOUDINARY_API_SECRET" && !secret) secret = v;
		}
	}
	return { key, secret };
}

const slugify = (name) =>
	name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function parseNames() {
	const map = {};
	for (const line of fs.readFileSync(NAMES, "utf8").split("\n")) {
		const m = /^(\d+):\s*(.+?)\s*$/.exec(line);
		if (!m) continue;
		const rank = Number(m[1]);
		const name = m[2].trim();
		if (name && name.toUpperCase() !== "DROP") map[rank] = name;
	}
	return map;
}

async function fetchDisplayNameMap(auth) {
	const url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/search`;
	const map = {};
	let cursor = null;
	for (let p = 0; p < 6; p++) {
		const body = { expression: `tags=${TAG} AND type:authenticated`, max_results: 500 };
		if (cursor) body.next_cursor = cursor;
		const r = await fetch(url, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
		const d = await r.json();
		for (const res of d.resources || []) if (res.display_name) map[res.display_name] = res.public_id;
		cursor = d.next_cursor;
		if (!cursor) break;
	}
	return map;
}

async function main() {
	const { key, secret } = loadCreds();
	if (!key || !secret) throw new Error("Missing Cloudinary creds (env or .env)");
	cloudinary.config({ cloud_name: CLOUD, api_key: key, api_secret: secret, secure: true });
	const auth = Buffer.from(`${key}:${secret}`).toString("base64");

	const clusters = JSON.parse(fs.readFileSync(CLUSTERS, "utf8")).clusters;
	const byRank = new Map(clusters.map((c) => [c.rank, c]));
	const names = parseNames();
	console.log(`${Object.keys(names).length} named people kept (rest dropped)`);

	const dnMap = await fetchDisplayNameMap(auth);
	console.log(`${Object.keys(dnMap).length} Cloudinary photos indexed by display name`);

	const index = [];
	const seenSlug = new Set();
	const byRep = new Map(); // repPublicId -> ["slug~Name~x_y_w_h", ...]
	for (const [rankStr, name] of Object.entries(names)) {
		const rank = Number(rankStr);
		const cluster = byRank.get(rank);
		if (!cluster) { console.warn(`  rank ${rank} (${name}) not in clusters.json — skip`); continue; }
		let slug = slugify(name);
		while (seenSlug.has(slug)) slug = `${slug}-${rank}`;
		seenSlug.add(slug);

		const photoIds = cluster.photos.map((s) => dnMap[s]).filter(Boolean);
		const repId = dnMap[cluster.representative.stem];
		if (!repId || photoIds.length === 0) { console.warn(`  ${name}: no Cloudinary match — skip`); continue; }
		const box = cluster.representative.bbox_frac.join("_"); // x_y_w_h fractions

		index.push({ slug, name, count: photoIds.length });
		console.log(`  face:${slug.padEnd(14)} ${String(photoIds.length).padStart(3)} photos`);
		if (!DRY) {
			// add_tag accepts up to 1000 public_ids per call; none exceed that.
			await cloudinary.uploader.add_tag(`face:${slug}`, photoIds, { type: "authenticated", resource_type: "image" });
		}
		// Group each person's definition (its OWN correct face box) under its
		// representative photo. A photo that's the rep for several people holds
		// all their defs, so chips never collide on the wrong face.
		if (!byRep.has(repId)) byRep.set(repId, []);
		byRep.get(repId).push(`${slug}~${name}~${box}`);
	}

	if (DRY) {
		console.log(`\n[dry-run] would tag ${index.length} people + define across ${byRep.size} representative photos`);
		return;
	}
	for (const [repId, defs] of byRep) {
		await cloudinary.uploader.add_context({ pdefs: defs.join(";") }, [repId], { type: "authenticated", resource_type: "image" });
	}
	console.log(`\nTagged ${index.length} people + wrote pdefs to ${byRep.size} representative photos.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
