// Front matter: the block of post details at the top of a post's .md file.
//
//   ---
//   title: My Sense of Design
//   date: 2021-04-14
//   description: One or two lines for the post list and link previews.
//   updated: 2021-05-14          (optional)
//   note: Written in 2021. …     (optional; shown above the text)
//   published: false             (optional; leaves it off the /blog list)
//   ---
//   ## First heading …
//
// Each line is `key: value` on one line. This is a small subset of YAML on
// purpose, so it needs no parser package. Quotes around a value are
// optional and are removed.

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KNOWN = new Set(["title", "date", "updated", "description", "note", "published"]);

/** Split a post file into its details and its Markdown text. */
export function splitFrontMatter(text) {
	const m = FENCE.exec(text);
	if (!m) return { data: {}, body: text };
	const data = {};
	for (const line of m[1].split(/\r?\n/)) {
		if (!line.trim() || line.trim().startsWith("#")) continue;
		const i = line.indexOf(":");
		if (i < 1) throw new Error(`Front matter line isn't "key: value": ${line}`);
		const key = line.slice(0, i).trim();
		let value = line.slice(i + 1).trim();
		if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
		data[key] = value;
	}
	return { data, body: text.slice(m[0].length).replace(/^\s+/, "") };
}

/**
 * Check a post's details and shape them for the site. Throws with the file
 * name and what's wrong, so a bad post stops the build instead of shipping.
 */
export function toPostMeta(slug, data) {
	const fail = (msg) => { throw new Error(`Blog post "${slug}.md": ${msg}`); };
	if (!/^[a-z0-9-]+$/.test(slug)) fail("file name must be lowercase letters, numbers and dashes");
	for (const key of Object.keys(data)) if (!KNOWN.has(key)) fail(`unknown front matter field "${key}"`);
	for (const key of ["title", "date", "description"]) if (!data[key]) fail(`missing "${key}"`);
	for (const key of ["date", "updated"]) {
		if (data[key] && !DATE.test(data[key])) fail(`"${key}" must look like 2021-04-14`);
	}
	if (data.published && !["true", "false"].includes(data.published)) fail(`"published" must be true or false`);

	const meta = { slug, title: data.title, date: data.date, description: data.description, published: data.published !== "false" };
	if (data.updated) meta.updated = data.updated;
	if (data.note) meta.note = data.note;
	return meta;
}
