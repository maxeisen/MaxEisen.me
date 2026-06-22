import { describe, it, expect } from "vitest";
import {
	captureDateFrom,
	toLeanEntry,
	faceSlugs,
	sceneSlugs,
	personDef,
	buildGalleryData,
	SIGNED_GALLERY_TAGS,
	SCOPE_RE,
} from "./gallery.js";

describe("captureDateFrom", () => {
	it("normalizes EXIF DateTimeOriginal to zone-less ISO", () => {
		expect(captureDateFrom({ DateTimeOriginal: "2025:06:29 22:51:08" })).toBe("2025-06-29T22:51:08");
	});

	it("falls back to DateTimeDigitized when no Original", () => {
		expect(captureDateFrom({ DateTimeDigitized: "2025:06:29 22:51:08" })).toBe("2025-06-29T22:51:08");
	});

	it("uses IPTC DateCreated (with timezone offset) when EXIF capture date is absent", () => {
		// lab-scanned film keeps DateCreated but loses EXIF DateTimeOriginal;
		// the trailing offset is ignored.
		expect(captureDateFrom({ DateCreated: "2025:07:09 12:45:39-04:00" })).toBe("2025-07-09T12:45:39");
	});

	it("combines DigitalCreationDate + DigitalCreationTime", () => {
		expect(captureDateFrom({ DigitalCreationDate: "2025:07:09", DigitalCreationTime: "12:45:39-04:00" })).toBe(
			"2025-07-09T12:45:39",
		);
	});

	it("accepts a date-only field, defaulting time to midnight", () => {
		expect(captureDateFrom({ DigitalCreationDate: "2025:07:09" })).toBe("2025-07-09T00:00:00");
	});

	it("prefers true capture time over IPTC creation fields", () => {
		expect(
			captureDateFrom({ DateTimeOriginal: "2025:06:29 22:51:08", DateCreated: "2025:07:09 12:45:39" }),
		).toBe("2025-06-29T22:51:08");
	});

	it("ignores DateTime (that is the edit/export timestamp, not capture)", () => {
		expect(captureDateFrom({ DateTime: "2025:09:02 14:03:54" })).toBeNull();
	});

	it("returns null for empty / missing metadata", () => {
		expect(captureDateFrom({})).toBeNull();
		expect(captureDateFrom(null)).toBeNull();
		expect(captureDateFrom(undefined)).toBeNull();
	});

	it("returns null for an unparseable date string", () => {
		expect(captureDateFrom({ DateTimeOriginal: "not a date" })).toBeNull();
	});
});

describe("toLeanEntry", () => {
	const base = {
		public_id: "abc123",
		display_name: "LoriWaltenburyPhoto_M+L_1823",
		width: 3600,
		height: 2401,
		created_at: "2026-06-22T16:35:08+00:00",
		image_metadata: { DateTimeOriginal: "2025:06:29 22:51:08" },
	};

	it("keeps only the lean fields and derives captured_at from EXIF", () => {
		expect(toLeanEntry(base)).toEqual({
			public_id: "abc123",
			display_name: "LoriWaltenburyPhoto_M+L_1823",
			width: 3600,
			height: 2401,
			created_at: "2026-06-22T16:35:08+00:00",
			captured_at: "2025-06-29T22:51:08",
			caption: null,
		});
	});

	it("falls back captured_at to created_at when there is no capture date", () => {
		const r = { ...base, image_metadata: {} };
		expect(toLeanEntry(r).captured_at).toBe(base.created_at);
	});

	it("nulls display_name when absent", () => {
		const { display_name, ...rest } = base;
		expect(toLeanEntry(rest).display_name).toBeNull();
	});

	it("reads caption from structured metadata, then context", () => {
		expect(toLeanEntry({ ...base, metadata: { caption: "from meta" } }).caption).toBe("from meta");
		expect(toLeanEntry({ ...base, context: { custom: { caption: "from ctx" } } }).caption).toBe("from ctx");
		expect(toLeanEntry({ ...base, context: { caption: "ctx flat" } }).caption).toBe("ctx flat");
	});
});

describe("faceSlugs / sceneSlugs", () => {
	const r = { tags: ["wedding", "face:lara", "face:max", "scene:ceremony", "scene:family"] };
	it("extracts people slugs from face: tags", () => {
		expect(faceSlugs(r)).toEqual(["lara", "max"]);
	});
	it("extracts scene slugs from scene: tags", () => {
		expect(sceneSlugs(r)).toEqual(["ceremony", "family"]);
	});
	it("returns [] when there are no tags", () => {
		expect(faceSlugs({})).toEqual([]);
		expect(sceneSlugs({})).toEqual([]);
	});
});

describe("personDef", () => {
	it("parses a definition from rep-photo context", () => {
		expect(
			personDef({ public_id: "p1", context: { custom: { pslug: "lara", pname: "Lara", pbox: "0.1_0.2_0.3_0.4" } } }),
		).toEqual({ slug: "lara", name: "Lara", repPublicId: "p1", box: [0.1, 0.2, 0.3, 0.4] });
	});
	it("returns null when the photo defines no person", () => {
		expect(personDef({ public_id: "p1", context: { custom: { caption: "hi" } } })).toBeNull();
	});
	it("nulls the box when pbox is empty/malformed (chip falls back to face crop)", () => {
		expect(personDef({ public_id: "p1", context: { custom: { pslug: "x", pbox: "" } } }).box).toBeNull();
		expect(personDef({ public_id: "p1", context: { custom: { pslug: "x", pbox: "1_2" } } }).box).toBeNull();
	});
});

describe("buildGalleryData", () => {
	const resources = [
		{ public_id: "a", tags: ["face:lara", "scene:ceremony"], context: { custom: { pslug: "lara", pname: "Lara", pbox: "0.1_0.2_0.3_0.4" } } },
		{ public_id: "b", tags: ["face:lara", "face:max"] },
	];
	const { photos, people } = buildGalleryData(resources);

	it("tags each photo with its people + scenes", () => {
		expect(photos[0].people).toEqual(["lara"]);
		expect(photos[0].scenes).toEqual(["ceremony"]);
		expect(photos[1].people).toEqual(["lara", "max"]);
		expect(photos[1].scenes).toEqual([]);
	});
	it("indexes only DEFINED people, with full appearance counts", () => {
		expect(people).toHaveLength(1); // max has a tag but no definition → not a filter chip
		expect(people[0]).toMatchObject({ slug: "lara", name: "Lara", count: 2, repPublicId: "a", box: [0.1, 0.2, 0.3, 0.4] });
	});
});

describe("config invariants", () => {
	it("wedding is a registered signed gallery", () => {
		expect(SIGNED_GALLERY_TAGS).toContain("wedding");
	});

	it("SCOPE_RE accepts plain slugs and rejects anything else", () => {
		expect(SCOPE_RE.test("wedding")).toBe(true);
		expect(SCOPE_RE.test("ride2")).toBe(true);
		expect(SCOPE_RE.test("we dding")).toBe(false);
		expect(SCOPE_RE.test("../etc")).toBe(false);
		expect(SCOPE_RE.test("")).toBe(false);
	});
});
