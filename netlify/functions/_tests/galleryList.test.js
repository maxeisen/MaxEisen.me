import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "../galleryList.js";

const CAMERA_FIELD = {
	external_id: "camera",
	datasource: {
		values: [
			{ external_id: "fujifilm_x100v", value: "Fujifilm X100V" },
			{ external_id: "fujifilm_x100s", value: "Fujifilm X100S" },
		],
	},
};

function stubCloudinary({ resources, cameraField = CAMERA_FIELD, cameraOk = true }) {
	vi.stubGlobal("fetch", vi.fn(async (url) => {
		if (String(url).endsWith("/metadata_fields/camera")) {
			return new Response(JSON.stringify(cameraField), { status: cameraOk ? 200 : 500 });
		}
		return new Response(JSON.stringify({ resources }), { status: 200 });
	}));
}

// Each test uses its own tag so the per-tag memo never serves a prior result.
async function list(tag) {
	const headers = { "x-gallery-password": "pw" };
	const res = await handler(new Request(`https://x/.netlify/functions/galleryList?tag=${tag}`, { headers }));
	return (await res.json()).resources;
}

beforeEach(() => {
	process.env.GALLERY_RIDE_PASSWORD = "pw";
	process.env.CLOUDINARY_API_KEY = "key";
	process.env.CLOUDINARY_API_SECRET = "sec";
});
afterEach(() => vi.unstubAllGlobals());

describe("galleryList camera", () => {
	it("maps the camera enum id to its datasource label", async () => {
		stubCloudinary({
			resources: [
				{ public_id: "a", metadata: { camera: "fujifilm_x100v" } },
				{ public_id: "b", metadata: { camera: "fujifilm_x100s" } },
				{ public_id: "c", metadata: {} },
			],
		});
		const photos = await list("gallery");
		expect(photos.map((p) => p.camera)).toEqual(["Fujifilm X100V", "Fujifilm X100S", null]);
	});

	it("omits the camera (rather than failing) when labels can't be fetched", async () => {
		stubCloudinary({
			resources: [{ public_id: "a", metadata: { camera: "fujifilm_x100v", caption: "Paris" } }],
			cameraOk: false,
		});
		const [photo] = await list("ride");
		expect(photo.camera).toBeNull();
		expect(photo.caption).toBe("Paris");
	});
});
