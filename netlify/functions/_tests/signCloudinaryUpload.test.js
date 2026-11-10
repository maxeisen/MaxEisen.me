import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import handler, { ALLOWED_FORMATS } from "../signCloudinaryUpload.js";

const ENV = {
	GALLERY_RIDE_PASSWORD: "pedal",
	CLOUDINARY_API_KEY: "key-123",
	CLOUDINARY_API_SECRET: "secret-456",
};

function request({ password = "pedal", body = { scope: "ride", uploader: "Max" }, method = "POST" } = {}) {
	return new Request("https://maxeisen.me/.netlify/functions/signCloudinaryUpload", {
		method,
		headers: { "Content-Type": "application/json", "X-Gallery-Password": password },
		body: method === "POST" ? JSON.stringify(body) : undefined,
	});
}

let saved;
beforeEach(() => {
	saved = { ...process.env };
	Object.assign(process.env, ENV);
});
afterEach(() => {
	process.env = saved;
});

describe("signCloudinaryUpload", () => {
	it("rejects a wrong password and an unconfigured scope alike", async () => {
		expect((await handler(request({ password: "nope" }))).status).toBe(401);
		expect((await handler(request({ body: { scope: "secret" } }))).status).toBe(401);
	});

	it("rejects non-POST and malformed scopes", async () => {
		expect((await handler(request({ method: "GET" }))).status).toBe(405);
		expect((await handler(request({ body: { scope: "../x" } }))).status).toBe(400);
	});

	it("signs allowed_formats so the signature can't be reused for other file types", async () => {
		const res = await handler(request());
		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe("no-store");
		const body = await res.json();
		expect(body.allowed_formats).toBe(ALLOWED_FORMATS);
		expect(body).not.toHaveProperty("api_secret");
		expect(JSON.stringify(body)).not.toContain(ENV.CLOUDINARY_API_SECRET);

		const toSign = `allowed_formats=${ALLOWED_FORMATS}&folder=rides&metadata=uploader=Max&tags=ride&timestamp=${body.timestamp}`;
		const expected = createHash("sha1").update(toSign + ENV.CLOUDINARY_API_SECRET).digest("hex");
		expect(body.signature).toBe(expected);
	});

	it("quotes uploader names that would break Cloudinary's metadata syntax", async () => {
		const body = await (await handler(request({ body: { scope: "ride", uploader: 'a|b="c"' } }))).json();
		expect(body.metadata).toBe('uploader="a|b=\\"c\\""');
	});
});
