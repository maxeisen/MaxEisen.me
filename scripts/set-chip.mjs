// Swap a person's face-filter chip to a specific photo.
//
//   npm run gallery:chip -- "<person>" "<photo>"
//
//   <person>  first name (as labeled) or slug, e.g. "Lara" or "olivia-d"
//   <photo>   the photo's filename / display name (e.g. LoriWaltenburyPhoto_M+L_1823)
//             OR its Cloudinary public_id
//
// By default the chip is a face-gravity crop of that photo (great when the
// person is the clear subject). Pass --box x,y,w,h (fractions 0-1) to crop a
// specific region if a group shot grabs the wrong face.
//
// After it runs: redeploy to make it live —
//   git commit --allow-empty -m "redeploy: chip swap" && git push
//
// Reads creds from process.env or .env. Updates Cloudinary pdefs context +
// regenerates the local manifest.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { v2 as cloudinary } from "cloudinary";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const MANIFEST = path.join(ROOT, "netlify/functions/_generated/gallery-wedding.json");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const boxArg = (process.argv.find((a) => a.startsWith("--box=")) || "").split("=")[1];
const DRY = process.argv.includes("--dry-run");
const [person, photo] = args;
if (!person || !photo) {
	console.error('Usage: npm run gallery:chip -- "<person>" "<photo filename or public_id>" [--box=x,y,w,h]');
	process.exit(1);
}

function creds() {
	let { CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
	const envp = path.join(ROOT, ".env");
	if ((!key || !secret) && fs.existsSync(envp)) {
		for (const line of fs.readFileSync(envp, "utf8").split("\n")) {
			const i = line.indexOf("="); if (i < 0) continue;
			const k = line.slice(0, i).trim(), v = line.slice(i + 1).trim();
			if (k === "CLOUDINARY_API_KEY" && !key) key = v;
			if (k === "CLOUDINARY_API_SECRET" && !secret) secret = v;
		}
	}
	return { key, secret };
}

async function pdefsOf(id) {
	const r = await cloudinary.api.resource(id, { type: "authenticated", context: true });
	const pd = r.context?.custom?.pdefs || "";
	return pd ? pd.split(";").map((e) => { const [slug, name, box] = e.split("~"); return { slug, name, box }; }) : [];
}
async function writePdefs(id, entries) {
	const val = entries.map((e) => `${e.slug}~${e.name}~${e.box}`).join(";");
	await cloudinary.uploader.add_context({ pdefs: val }, [id], { type: "authenticated", resource_type: "image" });
}

async function main() {
	const { key, secret } = creds();
	if (!key || !secret) { console.error("Missing Cloudinary creds (.env or env)"); process.exit(1); }
	cloudinary.config({ cloud_name: "meisen-gallery", api_key: key, api_secret: secret, secure: true });

	const man = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
	const q = person.toLowerCase();
	const p = man.people.find((x) => x.slug === q || x.name.toLowerCase() === q);
	if (!p) { console.error(`Person "${person}" not found. Options: ${man.people.map((x) => x.name).join(", ")}`); process.exit(1); }

	const target = man.photos.find((x) => x.public_id === photo || x.display_name === photo);
	if (!target) { console.error(`Photo "${photo}" not found (give its filename/display name or public_id).`); process.exit(1); }
	if (!(target.people || []).includes(p.slug)) {
		console.warn(`Note: "${p.name}" isn't tagged in that photo — the chip may crop the wrong face. Proceeding.`);
	}

	const box = boxArg ? boxArg.split(",").map(Number).join("_") : ""; // "" → face-gravity crop
	const oldRep = p.repPublicId;
	console.log(`${p.name}: ${oldRep} -> ${target.public_id}${box ? ` (box ${box})` : " (auto face crop)"}`);
	if (DRY) { console.log("[dry-run] no changes made"); return; }

	// Remove from old rep photo, add to the target photo (handle same photo).
	const oldEntries = (await pdefsOf(oldRep)).filter((e) => e.slug !== p.slug);
	if (oldRep !== target.public_id) await writePdefs(oldRep, oldEntries);
	const tgtEntries = (oldRep === target.public_id ? oldEntries : await pdefsOf(target.public_id)).filter((e) => e.slug !== p.slug);
	tgtEntries.push({ slug: p.slug, name: p.name, box });
	await writePdefs(target.public_id, tgtEntries);

	console.log("Updated Cloudinary. Regenerating manifest…");
	execSync("npm run gallery:manifest", { cwd: ROOT, stdio: "inherit" });
	console.log(`\nDone. Redeploy to go live:\n  git commit --allow-empty -m "redeploy: chip swap (${p.name})" && git push`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
