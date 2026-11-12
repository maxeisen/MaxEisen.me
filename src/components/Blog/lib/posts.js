// The blog's post list and the small formatting it needs.
//
// Each post is one file, public/content/blog/<slug>.md: its details in front
// matter at the top (see frontMatter.js), then the Markdown text. A post
// with `published: false` is left off the /blog list but still opens at its
// own URL, so a draft can be read in place before it's listed.

// Every post's details, checked at build time by postsPlugin.js. Small, so
// they're bundled with the page.
const META = import.meta.glob("/public/content/blog/*.md", { query: "?meta", import: "default", eager: true });
const allPosts = Object.values(META);

// Each post's text as its own chunk: opening one post doesn't download the
// others, and the list page downloads none of them.
const BODIES = import.meta.glob("/public/content/blog/*.md", { query: "?body", import: "default" });

/** Published posts, newest first. */
export function listPosts(posts = allPosts) {
	return posts.filter((p) => p.published).sort((a, b) => b.date.localeCompare(a.date));
}

/** The post with this slug (published or not), or null. */
export function findPost(slug, posts = allPosts) {
	return posts.find((p) => p.slug === slug) ?? null;
}

/** The posts either side of this one in the list: newer and older. */
export function neighbours(slug, posts = allPosts) {
	const list = listPosts(posts);
	const i = list.findIndex((p) => p.slug === slug);
	if (i < 0) return { newer: null, older: null };
	return { newer: list[i - 1] ?? null, older: list[i + 1] ?? null };
}

/** The post's Markdown text (without front matter), or null if there's no file for it. */
export async function loadPostBody(slug) {
	const load = BODIES[`/public/content/blog/${slug}.md`];
	return load ? load() : null;
}

/** "/blog/sense-of-design" → "sense-of-design"; anything else → null. */
export function slugFromPath(pathname) {
	const m = /^\/blog\/([a-z0-9-]+)\/?$/.exec(pathname);
	return m ? m[1] : null;
}

const LONG = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

/** "2021-04-14" → "April 14, 2021" (or "Apr 14, 2021" with short). */
export function formatDate(iso, { short = false } = {}) {
	const d = new Date(`${iso}T00:00:00Z`);
	if (Number.isNaN(d.getTime())) return iso;
	return (short ? SHORT : LONG).format(d);
}

/** Minutes to read at about 230 words a minute, never less than 1. */
export function readingMinutes(markdown) {
	const words = String(markdown).trim().split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(words / 230));
}
