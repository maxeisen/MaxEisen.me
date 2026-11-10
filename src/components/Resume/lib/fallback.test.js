import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { escapeHtml, injectResumeFallback, renderResumeFallback } from "./fallback.js";

const resume = JSON.parse(readFileSync(new URL("../../../../public/content/resume.json", import.meta.url), "utf8"));
const shell = readFileSync(new URL("../../../../index.html", import.meta.url), "utf8");

describe("the plain résumé", () => {
	const html = renderResumeFallback(resume);

	it("has every job, school and contact from resume.json", () => {
		for (const job of resume.experience) {
			expect(html).toContain(escapeHtml(job.company));
			expect(html).toContain(escapeHtml(job.position));
		}
		for (const ed of resume.education) expect(html).toContain(escapeHtml(ed.school));
		for (const c of resume.contact) expect(html).toContain(`href="${escapeHtml(c.href)}"`);
	});

	it("links the PDF", () => {
		expect(html).toContain('href="/MaxEisen_Resume.pdf"');
	});

	it("keeps the bullets' own markup but escapes plain fields", () => {
		const out = renderResumeFallback({
			name: "<b>x</b>",
			experience: [{ position: "P", company: "C & Co", bullets: ["<strong>kept</strong>"] }],
		});
		expect(out).toContain("&lt;b&gt;x&lt;/b&gt;");
		expect(out).toContain("C &amp; Co");
		expect(out).toContain("<li><strong>kept</strong></li>");
	});
});

describe("injecting into the shell", () => {
	const out = injectResumeFallback(shell, renderResumeFallback(resume));

	it("replaces the site-wide noscript and leaves exactly one", () => {
		expect(out.match(/<noscript>/g)).toHaveLength(1);
		expect(out).not.toContain("This site needs JavaScript");
		expect(out).toContain('class="resume-noscript"');
	});

	it("leaves the app mount and module script alone", () => {
		expect(out).toContain('<div id="app"></div>');
		expect(out).toContain('src="/src/main.js"');
	});

	it("doesn't read $ in the content as a replacement pattern", () => {
		expect(injectResumeFallback("<body><noscript>x</noscript></body>", "$&$1")).toContain("<noscript>\n$&$1\n</noscript>");
	});
});
