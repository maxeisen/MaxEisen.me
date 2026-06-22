import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the manifest file read and Cloudinary URL signing so the test is
// hermetic (no network, no real generated file, no API secret).
vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));
vi.mock("cloudinary", () => ({
	v2: {
		config: vi.fn(),
		// Deterministic, distinguishable stand-in for a signed URL.
		url: (id, opts) => {
			const t = opts.transformation?.[0] || {};
			const kind = t.flags ? "download" : t.width === 800 ? "thumb" : "full";
			return `https://signed/${kind}/${id}`;
		},
	},
}));

import { readFileSync } from "node:fs";
import handler from "./signedGalleryList.js";

const PW = "secret";
function call(tag, pw) {
	const headers = pw === undefined ? {} : { "x-gallery-password": pw };
	return handler(new Request(`https://x/.netlify/functions/signedGalleryList?tag=${tag}`, { headers }));
}

beforeEach(() => {
	process.env.GALLERY_WEDDING_PASSWORD = PW;
	process.env.CLOUDINARY_API_KEY = "key";
	process.env.CLOUDINARY_API_SECRET = "sec";
	vi.mocked(readFileSync).mockReset();
});

describe("signedGalleryList gating", () => {
	it("rejects a malformed tag with 400 (and never caches)", async () => {
		const res = await call("bad_tag", PW);
		expect(res.status).toBe(400);
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	it("returns 401 when no password is supplied", async () => {
		expect((await call("wedding")).status).toBe(401);
	});

	it("returns 401 for the wrong password", async () => {
		const res = await call("wedding", "nope");
		expect(res.status).toBe(401);
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	it("returns 401 when the gallery has no configured password (does not leak existence)", async () => {
		delete process.env.GALLERY_WEDDING_PASSWORD;
		expect((await call("wedding", "anything")).status).toBe(401);
	});

	it("returns 503 when Cloudinary creds are missing", async () => {
		delete process.env.CLOUDINARY_API_KEY;
		expect((await call("wedding", PW)).status).toBe(503);
	});
});

describe("signedGalleryList success path", () => {
	const manifest = [
		{
			public_id: "p1",
			display_name: "IMG_1",
			width: 100,
			height: 100,
			created_at: "2026-06-22T16:00:00Z",
			captured_at: "2025-06-29T09:00:00",
			caption: null,
		},
	];

	it("reads the manifest, attaches signed urls, and caches privately", async () => {
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(manifest));
		const res = await call("wedding", PW);
		expect(res.status).toBe(200);
		// Per-viewer cache only — never a shared/CDN cache.
		expect(res.headers.get("cache-control")).toBe("private, max-age=600");

		const body = await res.json();
		expect(body.resources).toHaveLength(1);
		const p = body.resources[0];
		// lean fields preserved …
		expect(p.public_id).toBe("p1");
		expect(p.captured_at).toBe("2025-06-29T09:00:00");
		expect(p.display_name).toBe("IMG_1");
		// … and the three signed delivery URLs attached.
		expect(p.thumb).toBe("https://signed/thumb/p1");
		expect(p.full).toBe("https://signed/full/p1");
		expect(p.download).toBe("https://signed/download/p1");
	});
});
