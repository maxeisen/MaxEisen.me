import { describe, expect, it } from "vitest";
import { externalizeLinks, isExternalHref } from "./externalLinks.js";

describe("isExternalHref", () => {
	it("treats other origins as external", () => {
		expect(isExternalHref("https://github.com/maxeisen")).toBe(true);
		expect(isExternalHref("http://www.cips.ca/")).toBe(true);
	});

	it("treats this site, relative paths and mailto as internal", () => {
		expect(isExternalHref("https://maxeisen.me/running")).toBe(false);
		expect(isExternalHref("https://www.maxeisen.me/")).toBe(false);
		expect(isExternalHref("/gallery")).toBe(false);
		expect(isExternalHref("#top")).toBe(false);
		expect(isExternalHref("mailto:hi@example.com")).toBe(false);
		expect(isExternalHref(undefined)).toBe(false);
	});
});

describe("externalizeLinks", () => {
	it("opens off-site links in a new tab", () => {
		expect(externalizeLinks('Built on <a href="https://aws.amazon.com/">AWS</a>')).toBe(
			'Built on <a href="https://aws.amazon.com/" target="_blank" rel="noreferrer">AWS</a>',
		);
	});

	it("leaves internal links alone so the router handles them", () => {
		const html = 'See the <a href="/gallery">gallery</a> and <a href="https://maxeisen.me/running">running</a>';
		expect(externalizeLinks(html)).toBe(html);
	});

	it("keeps a target that is already set", () => {
		const html = '<a href="https://x.com/" target="_self">X</a>';
		expect(externalizeLinks(html)).toBe(html);
	});

	it("handles several links and single-quoted attributes", () => {
		expect(externalizeLinks("<a href='https://a.com'>a</a> <a class=\"k\" href=\"/b\">b</a>")).toBe(
			"<a href='https://a.com' target=\"_blank\" rel=\"noreferrer\">a</a> <a class=\"k\" href=\"/b\">b</a>",
		);
	});

	it("passes empty input through", () => {
		expect(externalizeLinks("")).toBe("");
		expect(externalizeLinks(null)).toBe(null);
	});
});
