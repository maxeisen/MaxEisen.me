import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const notFoundHtml = readFileSync(new URL("../public/404.html", import.meta.url), "utf8");

describe("which stylesheets each document asks for", () => {
	it("the SPA shell loads only the shared sheet — every route, the résumé included, shares this document", () => {
		expect(indexHtml).toContain('href="/styles/global.css"');
		expect(indexHtml).not.toMatch(/index\.css/);
		expect(indexHtml).not.toMatch(/resume\.css/);
		expect(indexHtml).not.toMatch(/rel=["']next["']/);
		expect(indexHtml).not.toMatch(/alternate stylesheet/);
	});

	it("the 404 page only loads its own sheet, not the SPA or resume ones", () => {
		expect(notFoundHtml).toContain('href="/styles/404.css"');
		expect(notFoundHtml).not.toMatch(/index\.css/);
		expect(notFoundHtml).not.toMatch(/resume\.css/);
	});
});
