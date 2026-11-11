import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import handler from "./og.js";

const SHELL = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

async function render(path) {
	const context = { next: async () => new Response(SHELL, { headers: { "content-type": "text/html; charset=utf-8" } }) };
	const res = await handler(new Request(`https://maxeisen.me${path}`), context);
	return res.text();
}

const count = (html, re) => (html.match(re) || []).length;

beforeEach(() => {
	// /running fetches the plan file; no plan is the running-log card.
	globalThis.fetch = async () => new Response("not found", { status: 404 });
});

describe("og edge function", () => {
	it("gives the homepage its full title", async () => {
		const html = await render("/");
		expect(html).toContain("<title>Max Eisen — Software Engineer in Toronto</title>");
		expect(html).toContain('<meta property="og:title" content="Max Eisen — Software Engineer in Toronto"/>');
	});

	it.each(["/", "/resume", "/running", "/gallery"])("leaves exactly one of each social tag on %s", async (path) => {
		const html = await render(path);
		for (const tag of [
			"og:title", "og:description", "og:url", "og:image", "og:image:width", "og:image:height",
			"twitter:card", "twitter:title", "twitter:description", "twitter:image",
		]) {
			expect(count(html, new RegExp(`<meta (property|name)="${tag}"`, "g")), tag).toBe(1);
		}
		expect(count(html, /<title>/g)).toBe(1);
	});

	it("titles a route from its own entry", async () => {
		const html = await render("/resume");
		expect(html).toContain('<meta name="twitter:title" content="Resume — Max Eisen"/>');
	});
});
