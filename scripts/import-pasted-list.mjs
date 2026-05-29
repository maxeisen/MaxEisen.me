#!/usr/bin/env node
// One-shot importer for a curated Google Maps list that was pasted into
// the conversation. Geocodes each name via Nominatim (OpenStreetMap's
// free geocoder — no API key, but 1 req/sec rate limit and must send a
// real User-Agent identifying the app).
//
// Writes published pins straight to public/content/toronto.json,
// merging with anything already there.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(REPO_ROOT, "public", "content", "toronto.json");

// Manually curated from a Google Maps shared list. Notes converted from
// public-list third person ("Max's favourite…") to portfolio first
// person ("My favourite…"). Geocoded automatically.
const PLACES = [
	{ name: "Bar Raval",                hint: "505 College Street Toronto",      category: "drink",   notes: "Simple but excellent Spanish-style tapas, excellent drinks." },
	{ name: "Danny's Pizza Tavern",     hint: "1290 Bloor Street West Toronto",  category: "eat",     notes: "One of my faves — casual tavern-style pizza. Try the cacio e pepe!" },
	{ name: "Pizzeria Badiali",         hint: "181 Dundas Street West Toronto",  category: "eat",     notes: '"Best pizza in Toronto"… debatable but very good.' },
	{ name: "PAI Northern Thai Kitchen", hint: "18 Duncan Street Toronto",       category: "eat",     notes: "Michelin-star Thai food. A little overhyped — prepare to wait." },
	{ name: "Centre Island",            hint: "Toronto",                          category: "walk",    notes: "The most central of Toronto's islands. Lovely for walking, biking, a quick (overpriced) bite, or a chill beach (avoid the nudist beach… or don't, if you're into that)." },
	{ name: "Koh Lipe Thai Kitchen",    hint: "397 Roncesvalles Avenue Toronto",  category: "eat",     notes: "Excellent Thai food." },
	{ name: "Royal Ontario Museum",     hint: "100 Queens Park Toronto",          category: "culture", notes: "Our #1 museum." },
	{ name: "Little Canada",            hint: "10 Dundas Street East Toronto",    category: "culture", notes: "Relatively new tourist attraction — see all of Canada in one shot." },
	{ name: "Sunny's Chinese",          hint: "82 Ossington Avenue Toronto",      category: "eat",     notes: "Great modern Chinese from different regions of China. Vibey, expensive, and in a really cool / multicultural neighbourhood (Kensington Market)." },
	{ name: "Bernhardt's",              hint: "202 Dovercourt Road Toronto",      category: "eat",     notes: "My favourite dinner food in the city." },
	{ name: "Union Restaurant",         hint: "72 Ossington Avenue Toronto",      category: "eat",     notes: "My favourite brunch in the city." },
	{ name: "Pho Tien Thanh",           hint: "57 Ossington Avenue Toronto",      category: "eat",     notes: "Widely regarded as the best pho in the city." },
	{ name: "Found Coffee",             hint: "1240 Queen Street West Toronto",   category: "coffee",  notes: "My favourite coffee shop in the city." },
	{ name: "Trinity Bellwoods Park",   hint: "Toronto",                          category: "walk",    notes: "Nice, central park with good vibes (drinking allowed!)." },
	{ name: "High Park",                hint: "Toronto",                          category: "walk",    notes: "Great park for chilling and walking — just a little far from the core." },
];

const UA = "maxeisen.me toronto-map importer (contact: profile@maxeisen.me)";

function slugify(s) {
	return String(s)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

async function geocode(name, hint) {
	const q = `${name} ${hint}`;
	const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
	const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" } });
	if (!res.ok) throw new Error(`${res.status} for "${q}"`);
	const arr = await res.json();
	if (!arr.length) return null;
	const [hit] = arr;
	return {
		lat: parseFloat(hit.lat),
		lng: parseFloat(hit.lon),
		address: hit.display_name,
	};
}

let existing = [];
if (existsSync(OUT_PATH)) {
	try {
		const raw = JSON.parse(await readFile(OUT_PATH, "utf8"));
		if (Array.isArray(raw)) existing = raw;
	} catch {}
}
const existingByName = new Map(existing.map((p) => [p.name.toLowerCase(), p]));

const out = [];
for (const place of PLACES) {
	const key = place.name.toLowerCase();
	if (existingByName.has(key)) {
		console.log(`  (skip existing) ${place.name}`);
		out.push(existingByName.get(key));
		existingByName.delete(key);
		continue;
	}
	process.stdout.write(`  geocoding ${place.name}… `);
	let geo;
	try {
		geo = await geocode(place.name, place.hint);
	} catch (err) {
		console.log(`FAILED (${err.message})`);
		await new Promise((r) => setTimeout(r, 1100));
		continue;
	}
	if (!geo) {
		console.log("no result");
		await new Promise((r) => setTimeout(r, 1100));
		continue;
	}
	console.log(`${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`);
	out.push({
		id: `${slugify(place.name)}-${Math.random().toString(36).slice(2, 8)}`,
		name: place.name,
		lat: geo.lat,
		lng: geo.lng,
		category: place.category,
		notes: place.notes,
		photo: null,
		published: true,
		address: geo.address,
		googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " " + place.hint)}`,
	});
	// Nominatim asks for ≤1 req/sec.
	await new Promise((r) => setTimeout(r, 1100));
}

// Append any prior entries that weren't in this batch.
for (const stray of existingByName.values()) out.push(stray);

await writeFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
console.log(`\nWrote ${out.length} pins to ${OUT_PATH}`);
