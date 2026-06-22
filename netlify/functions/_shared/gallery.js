// Shared Cloudinary gallery constants used by galleryList, checkGalleryPassword
// and signCloudinaryUpload.

export const CLOUD_NAME = "meisen-gallery";

// A gallery scope ("gallery", "ride", "run", …) is interpolated into the env
// var name `GALLERY_<SCOPE>_PASSWORD` and into Cloudinary tags/folders, so it
// must be a short plain-alnum slug. Anything else is rejected before we read
// any state or env var derived from caller input.
export const SCOPE_RE = /^[a-z0-9]{1,32}$/;

// Signed galleries whose listing is precomputed into a build-time manifest
// (the Cloudinary Admin search for 1000+ assets takes ~20s, far too slow to
// run per page load). Add a tag here + regenerate the manifest when it gains
// a new signed gallery.
export const SIGNED_GALLERY_TAGS = ["wedding"];

// Normalize a capture timestamp from a Cloudinary asset's image_metadata to a
// lexically-sortable, zone-less ISO shape ("2025-09-14T16:23:01") so a plain
// string compare orders photos chronologically. Prefers true EXIF capture
// time, then IPTC creation fields (lab-scanned film keeps DateCreated /
// DigitalCreationDate after its EXIF capture date is stripped). Deliberately
// NOT DateTime — that's the edit/export timestamp. Returns null when no
// capture date exists (the caller falls back to upload time).
export function captureDateFrom(imageMetadata) {
	const m = imageMetadata || {};
	const candidates = [
		m.DateTimeOriginal,
		m.DateTimeDigitized,
		m.DateCreated,
		m.DigitalCreationDate && m.DigitalCreationTime
			? `${m.DigitalCreationDate} ${m.DigitalCreationTime}`
			: m.DigitalCreationDate,
	];
	for (const raw of candidates) {
		if (!raw) continue;
		const dt = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(raw));
		if (dt) {
			const [, y, mo, d, h, mi, s] = dt;
			return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
		}
		const dOnly = /^(\d{4})[:-](\d{2})[:-](\d{2})$/.exec(String(raw));
		if (dOnly) {
			const [, y, mo, d] = dOnly;
			return `${y}-${mo}-${d}T00:00:00`;
		}
	}
	return null;
}

// Reduce a raw Cloudinary Admin-API resource to the lean, URL-free fields the
// gallery needs. This is what gets stored in the manifest (no signed URLs —
// those are minted per request — and no bulky image_metadata).
export function toLeanEntry(r) {
	const meta = r.metadata || {};
	const ctx = r.context?.custom || r.context || {};
	return {
		public_id: r.public_id,
		display_name: r.display_name || null,
		width: r.width,
		height: r.height,
		created_at: r.created_at,
		captured_at: captureDateFrom(r.image_metadata) || r.created_at,
		caption: meta.caption || meta.Caption || ctx.caption || null,
	};
}

// Face-filter people slugs present in a photo, from its `face:<slug>` tags.
export function faceSlugs(r) {
	return (r.tags || []).filter((t) => typeof t === "string" && t.startsWith("face:")).map((t) => t.slice(5));
}

// Scene slugs a photo belongs to, from its `scene:<slug>` tags. Display names
// + ordering live in the gallery route config, not here — this just carries
// which scenes each photo is tagged with.
export function sceneSlugs(r) {
	return (r.tags || []).filter((t) => typeof t === "string" && t.startsWith("scene:")).map((t) => t.slice(6));
}

// Person definitions stored in context on a representative photo. A single
// photo can define MORE THAN ONE person (when it's the best face for several),
// each with their own face box — so chips never collide on the wrong face.
// Format: `pdefs` = "slug~Name~x_y_w_h;slug2~Name2~x_y_w_h". Returns [].
export function personDefs(r) {
	const ctx = r.context?.custom || r.context || {};
	if (!ctx.pdefs) return [];
	return String(ctx.pdefs)
		.split(";")
		.map((entry) => {
			const [slug, name, boxStr] = entry.split("~");
			if (!slug) return null;
			const parts = boxStr ? boxStr.split("_").map(Number) : [];
			const box = parts.length === 4 && parts.every((n) => Number.isFinite(n)) ? parts : null;
			return { slug, name: name || slug, repPublicId: r.public_id, box };
		})
		.filter(Boolean);
}

// Assemble the gallery payload from raw Cloudinary resources: lean photos
// (each carrying the people slugs in it) + a people index (name, representative
// photo + face box, photo count), sorted most-photographed first.
export function buildGalleryData(resources) {
	const photos = [];
	const defs = {};
	const counts = {};
	for (const r of resources) {
		const lean = toLeanEntry(r);
		const slugs = faceSlugs(r);
		lean.people = slugs;
		lean.scenes = sceneSlugs(r);
		photos.push(lean);
		for (const s of slugs) counts[s] = (counts[s] || 0) + 1;
		for (const def of personDefs(r)) defs[def.slug] = def;
	}
	const people = Object.values(defs)
		.map((d) => ({ ...d, count: counts[d.slug] || 0 }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
	return { photos, people };
}
