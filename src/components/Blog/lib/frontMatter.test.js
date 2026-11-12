import { describe, it, expect } from "vitest";
import { splitFrontMatter, toPostMeta } from "./frontMatter.js";

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

	it("shapes valid details, published unless it says otherwise", () => {
		expect(toPostMeta("a-post", ok)).toEqual({ slug: "a-post", ...ok, published: true });
		expect(toPostMeta("a-post", { ...ok, published: "false", note: "N", updated: "2021-05-01" }))
			.toMatchObject({ published: false, note: "N", updated: "2021-05-01" });
	});

	it("names the file and the problem when details are wrong", () => {
		expect(() => toPostMeta("p", { ...ok, title: "" })).toThrow('"p.md": missing "title"');
		expect(() => toPostMeta("p", { ...ok, date: "April 14, 2021" })).toThrow(/"date" must look like/);
		expect(() => toPostMeta("p", { ...ok, tags: "x" })).toThrow(/unknown front matter field "tags"/);
		expect(() => toPostMeta("p", { ...ok, published: "no" })).toThrow(/true or false/);
		expect(() => toPostMeta("Bad_Name", ok)).toThrow(/file name/);
	});
});
