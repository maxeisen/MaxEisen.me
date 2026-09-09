import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const resumeHtml = readFileSync(new URL("../public/resume.html", import.meta.url), "utf8");
const notFoundHtml = readFileSync(new URL("../public/404.html", import.meta.url), "utf8");

describe("which stylesheets each document asks for", () => {
	it("the SPA shell does not prefetch resume.css — every route shares this document", () => {
		expect(indexHtml).toContain('href="/styles/global.css"');
		expect(indexHtml).toContain('href="/styles/index.css"');
		expect(indexHtml).not.toMatch(/resume\.css/);
		expect(indexHtml).not.toMatch(/rel=["']next["']/);
		expect(indexHtml).not.toMatch(/alternate stylesheet/);
	});

	it("the resume page does not prefetch the SPA's index.css", () => {
		expect(resumeHtml).toContain('href="/styles/global.css"');
		expect(resumeHtml).toContain('href="/styles/resume.css"');
		expect(resumeHtml).not.toMatch(/index\.css/);
		expect(resumeHtml).not.toMatch(/rel=["']next["']/);
		expect(resumeHtml).not.toMatch(/alternate stylesheet/);
	});

	it("the 404 page only loads its own sheet, not the SPA or resume ones", () => {
		expect(notFoundHtml).toContain('href="/styles/404.css"');
		expect(notFoundHtml).not.toMatch(/index\.css/);
		expect(notFoundHtml).not.toMatch(/resume\.css/);
	});
});
