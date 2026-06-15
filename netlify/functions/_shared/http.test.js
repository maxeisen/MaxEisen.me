import { describe, it, expect } from "vitest";
import { createJsonResponder, cacheControl } from "./http.js";

describe("cacheControl presets", () => {
	it("none is no-store", () => {
		expect(cacheControl.none).toEqual({ "Cache-Control": "no-store" });
	});

	it("swr interpolates max-age + stale-while-revalidate", () => {
		expect(cacheControl.swr(120, 300)).toEqual({
			"Cache-Control": "public, max-age=120, stale-while-revalidate=300",
		});
	});

	it("edgeBurst pairs a no-store browser policy with a short edge cache", () => {
		expect(cacheControl.edgeBurst(5)).toEqual({
			"Cache-Control": "private, max-age=0, must-revalidate",
			"Netlify-CDN-Cache-Control": "public, max-age=5",
		});
	});
});

describe("createJsonResponder", () => {
	it("serialises the body, defaults to 200, and sets Content-Type", async () => {
		const json = createJsonResponder();
		const res = json({ ok: true });
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/json");
		await expect(res.json()).resolves.toEqual({ ok: true });
	});

	it("passes through the status code", () => {
		const json = createJsonResponder();
		expect(json({ error: "nope" }, 503).status).toBe(503);
	});

	it("with no default headers emits only Content-Type (no Cache-Control)", () => {
		const json = createJsonResponder();
		expect(json({}).headers.get("Cache-Control")).toBeNull();
	});

	it("applies the bound default headers (caching intent)", () => {
		const json = createJsonResponder(cacheControl.swr(300, 600));
		expect(json({}).headers.get("Cache-Control")).toBe(
			"public, max-age=300, stale-while-revalidate=600",
		);
	});

	it("lets per-call extraHeaders override the defaults", () => {
		const json = createJsonResponder(cacheControl.swr(300, 900));
		const res = json({ error: "bad" }, 400, { "Cache-Control": "no-store" });
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("merges the edgeBurst preset's two headers", () => {
		const json = createJsonResponder(cacheControl.edgeBurst(5));
		const res = json({ playing: false });
		expect(res.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
		expect(res.headers.get("Netlify-CDN-Cache-Control")).toBe("public, max-age=5");
	});
});
