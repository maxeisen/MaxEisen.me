// Vite plugin: lets the app import a blog post's .md file in two parts.
//
//   post.md?meta  → the checked post details from its front matter (small;
//                   the /blog list imports every post's this way)
//   post.md?body  → the Markdown text without the front matter (imported
//                   one post at a time, when that post is opened)
//
// A post with bad or missing details fails the build (see toPostMeta), and
// so does a `cover` path with no file under public/.

import fs from "node:fs/promises";
import path from "node:path";
import { splitFrontMatter, toPostMeta } from "./frontMatter.js";

const PART = /^(.+\.md)\?(meta|body)$/;

export default function blogPosts() {
	let publicDir = "public";
	return {
		name: "blog-posts",
		enforce: "pre",

		configResolved(config) {
			publicDir = config.publicDir;
		},

		async load(id) {
			const m = PART.exec(id);
			if (!m) return null;
			const [, file, part] = m;
			this.addWatchFile(file);
			const { data, body } = splitFrontMatter(await fs.readFile(file, "utf8"));
			const slug = path.basename(file, ".md");
			let value = body;
			if (part === "meta") {
				value = toPostMeta(slug, data);
				if (value.cover?.startsWith("/")) await checkCover(slug, path.join(publicDir, value.cover));
			}
			return `export default ${JSON.stringify(value)};`;
		},
	};
}

async function checkCover(slug, file) {
	try {
		await fs.access(file);
	} catch {
		throw new Error(`Blog post "${slug}.md": no file for "cover" at ${file}`);
	}
}
