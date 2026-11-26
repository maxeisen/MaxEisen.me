import { describe, it, expect } from "vitest";
import { listPosts, findPost, neighbours, slugFromPath, formatDate, readingMinutes, loadPostBody, postsTagged, allTags, tagFromSearch } from "./posts.js";

const POSTS = [
	{ slug: "old", date: "2020-01-01", draft: false, tags: ["design"] },
	{ slug: "draft", date: "2022-01-01", draft: true, tags: ["secret", "design"] },
	{ slug: "new", date: "2021-06-01", draft: false, tags: ["web-dev", "design"] },
	{ slug: "mid", date: "2021-01-01", draft: false, tags: [] },
];

describe("listPosts", () => {
	it("leaves out drafts, newest first", () => {
		expect(listPosts(POSTS).map((p) => p.slug)).toEqual(["new", "mid", "old"]);
	});
});

describe("tags", () => {
	it("filters listed posts by tag, leaving out drafts", () => {
		expect(postsTagged("design", POSTS).map((p) => p.slug)).toEqual(["new", "old"]);
		expect(postsTagged("secret", POSTS)).toEqual([]);
	});

	it("counts the tags on listed posts, A to Z", () => {
		expect(allTags(POSTS)).toEqual([{ tag: "design", count: 2 }, { tag: "web-dev", count: 1 }]);
	});

	it("reads a valid tag from the query string", () => {
		expect(tagFromSearch("?tag=web-dev")).toBe("web-dev");
		expect(tagFromSearch("?tag=<b>")).toBeNull();
		expect(tagFromSearch("")).toBeNull();
	});
});

describe("findPost", () => {
	it("finds drafts too, so they open at their own URL", () => {
		expect(findPost("draft", POSTS)?.slug).toBe("draft");
		expect(findPost("nope", POSTS)).toBeNull();
	});
});

describe("neighbours", () => {
	it("gives the newer and older post in the list", () => {
		expect(neighbours("mid", POSTS)).toEqual({ newer: POSTS[2], older: POSTS[0] });
		expect(neighbours("new", POSTS).newer).toBeNull();
		expect(neighbours("draft", POSTS)).toEqual({ newer: null, older: null });
	});
});

describe("slugFromPath", () => {
	it("reads the slug from a post URL", () => {
		expect(slugFromPath("/blog/sense-of-design")).toBe("sense-of-design");
		expect(slugFromPath("/blog/sense-of-design/")).toBe("sense-of-design");
		expect(slugFromPath("/blog")).toBeNull();
		expect(slugFromPath("/blog/a/b")).toBeNull();
		expect(slugFromPath("/blog/Bad_Slug")).toBeNull();
	});
});

describe("formatDate", () => {
	it("formats the calendar day without shifting by time zone", () => {
		expect(formatDate("2021-04-14")).toBe("April 14, 2021");
		expect(formatDate("2021-04-14", { short: true })).toBe("Apr 14, 2021");
		expect(formatDate("not a date")).toBe("not a date");
	});
});

describe("readingMinutes", () => {
	it("rounds to whole minutes and never says 0", () => {
		expect(readingMinutes("one two")).toBe(1);
		expect(readingMinutes(Array(690).fill("w").join(" "))).toBe(3);
	});
});

describe("the real posts", () => {
	it("load their details from front matter and their text without it", async () => {
		const posts = listPosts();
		expect(posts.length).toBeGreaterThan(0);
		for (const post of posts) {
			expect(formatDate(post.date)).not.toBe(post.date);
			const body = await loadPostBody(post.slug);
			expect(body).toBeTruthy();
			expect(body.startsWith("---")).toBe(false);
		}
	});
});
