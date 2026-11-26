import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
// Lives here rather than beside og.js: Netlify deploys every file in
// netlify/edge-functions/ as an edge function, and a test file there (with its
// vitest and node:fs imports) fails the edge bundle and with it the deploy.
import handler, { cardUrl } from "../netlify/edge-functions/og.js";

const SHELL = readFileSync(new URL("../index.html", import.meta.url), "utf8");

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
	it("introduces Max on the homepage title and card", async () => {
		const html = await render("/");
		expect(html).toContain("<title>Max Eisen — Hi, I'm Max</title>");
		expect(html).toContain('<meta property="og:title" content="Max Eisen — Hi, I\'m Max"/>');
		expect(html).toContain(`<meta property="og:image" content="${cardUrl("Hi, I'm Max.")}"/>`);
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

describe("og edge function on the blog", () => {
	const POST = "---\ntitle: A Post\ndate: 2026-11-25\ndescription: What it's about.\n---\nText";
	const serve = (files) => {
		globalThis.fetch = async (url) => {
			const body = files[new URL(url).pathname];
			return body ? new Response(body) : new Response("not found", { status: 404 });
		};
	};

	it("titles the list", async () => {
		const html = await render("/blog");
		expect(html).toContain("<title>Blog — Max Eisen</title>");
		expect(html).toContain(`<meta property="og:image" content="${cardUrl("Blog")}"/>`);
	});

	it("draws a post's title on the card when it has no cover", async () => {
		serve({ "/content/blog/a-post.md": POST });
		const html = await render("/blog/a-post");
		expect(html).toContain("<title>A Post — Max Eisen</title>");
		expect(html).toContain('<meta property="og:description" content="What it\'s about."/>');
		expect(html).toContain('<meta property="og:type" content="article"/>');
		expect(html).toContain(`<meta property="og:image" content="${cardUrl("A Post")}"/>`);
		expect(count(html, /og:image:width/g)).toBe(1);
	});

	it("uses a post's cover as its image, without a made-up size", async () => {
		serve({ "/content/blog/a-post.md": POST.replace("---\nText", "cover: /img/blog/a-post/cover.jpg\n---\nText") });
		const html = await render("/blog/a-post");
		expect(html).toContain('<meta property="og:image" content="https://maxeisen.me/img/blog/a-post/cover.jpg"/>');
		expect(html).toContain('<meta name="twitter:image" content="https://maxeisen.me/img/blog/a-post/cover.jpg"/>');
		expect(count(html, /og:image:(width|height)/g)).toBe(0);
	});

	it("falls back to the default preview for a missing or broken post", async () => {
		serve({ "/content/blog/broken.md": "---\ntitle: No date\n---\n" });
		for (const path of ["/blog/no-such-post", "/blog/broken"]) {
			const html = await render(path);
			expect(html).toContain("<title>Max Eisen — Hi, I'm Max</title>");
		}
	});
});

describe("netlify/edge-functions", () => {
	it("holds nothing but deployable edge functions", async () => {
		const { readdirSync } = await import("node:fs");
		const files = readdirSync(new URL("../netlify/edge-functions/", import.meta.url));
		expect(files.filter((f) => /\.(test|spec)\.[cm]?[jt]s$/.test(f))).toEqual([]);
	});
});
