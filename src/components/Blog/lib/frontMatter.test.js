import { describe, it, expect } from "vitest";
import { splitFrontMatter, toPostMeta, parseTags } from "./frontMatter.js";

describe("splitFrontMatter", () => {
	it("reads key: value lines and returns the text after the block", () => {
		const { data, body } = splitFrontMatter(
			"---\ntitle: A: B\ndate: 2021-04-14\nnote: \"Quoted, with: colon\"\n---\n\n## Hello\nText",
		);
		expect(data).toEqual({ title: "A: B", date: "2021-04-14", note: "Quoted, with: colon" });
		expect(body).toBe("## Hello\nText");
	});

	it("leaves a file without front matter as it is", () => {
		expect(splitFrontMatter("## Hello")).toEqual({ data: {}, body: "## Hello" });
	});

	it("rejects a line that isn't key: value", () => {
		expect(() => splitFrontMatter("---\njust words\n---\n")).toThrow(/key: value/);
	});
});

describe("toPostMeta", () => {
	const ok = { title: "T", date: "2021-04-14", description: "D" };

	it("shapes valid details, not a draft unless it says so", () => {
		expect(toPostMeta("a-post", ok)).toEqual({ slug: "a-post", ...ok, draft: false, tags: [] });
		expect(toPostMeta("a-post", { ...ok, draft: "true", note: "N", updated: "2021-05-01" }))
			.toMatchObject({ draft: true, note: "N", updated: "2021-05-01" });
	});

	it("names the file and the problem when details are wrong", () => {
		expect(() => toPostMeta("p", { ...ok, title: "" })).toThrow('"p.md": missing "title"');
		expect(() => toPostMeta("p", { ...ok, date: "April 14, 2021" })).toThrow(/"date" must look like/);
		expect(() => toPostMeta("p", { ...ok, image: "x" })).toThrow(/unknown front matter field "image"/);
		expect(() => toPostMeta("p", { ...ok, draft: "no" })).toThrow(/true or false/);
		expect(() => toPostMeta("Bad_Name", ok)).toThrow(/file name/);
		expect(() => toPostMeta("p", { ...ok, tags: "web dev" })).toThrow(/tag "web dev" must be/);
		expect(() => toPostMeta("p", { ...ok, cover: "cover.jpg" })).toThrow(/"cover" must be a path/);
		expect(() => toPostMeta("p", { ...ok, cover: "//evil.example/x.jpg" })).toThrow(/"cover" must be a path/);
		expect(() => toPostMeta("p", { ...ok, cover: "http://example.com/x.jpg" })).toThrow(/"cover" must be a path/);
	});

	it("reads tags and a cover", () => {
		expect(toPostMeta("p", { ...ok, tags: "Design, web-dev, design", cover: "/img/blog/p/cover.jpg" }))
			.toMatchObject({ tags: ["design", "web-dev"], cover: "/img/blog/p/cover.jpg" });
		expect(toPostMeta("p", { ...ok, tags: "", cover: "https://example.com/x.jpg" }))
			.toMatchObject({ tags: [], cover: "https://example.com/x.jpg" });
	});
});

describe("parseTags", () => {
	it("trims, lowercases and drops repeats and empty entries", () => {
		expect(parseTags(" a , B,,a ")).toEqual(["a", "b"]);
		expect(parseTags(undefined)).toEqual([]);
	});
});
