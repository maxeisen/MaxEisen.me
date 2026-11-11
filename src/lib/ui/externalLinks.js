// One rule for links across the site: anything that leaves maxeisen.me opens
// in a new tab, and global.css marks every such link with a small ↗. Links
// written into content (JSON bullets, captions, blog markdown) arrive as raw
// HTML without a target, so they pass through externalizeLinks() before
// being rendered with {@html}.

const SITE_HOSTS = new Set(["maxeisen.me", "www.maxeisen.me"]);

export function isExternalHref(href) {
	if (!/^https?:\/\//i.test(href || "")) return false;
	try {
		return !SITE_HOSTS.has(new URL(href).hostname);
	} catch {
		return false;
	}
}

const HREF = /\shref\s*=\s*(["'])(.*?)\1/i;
const TARGET = /\starget\s*=/i;

/** Add target="_blank" rel="noreferrer" to off-site <a> tags that lack a target. */
export function externalizeLinks(html) {
	if (!html) return html;
	return html.replace(/<a\b([^>]*)>/gi, (tag, attrs) => {
		const href = attrs.match(HREF)?.[2];
		if (!isExternalHref(href) || TARGET.test(attrs)) return tag;
		return `<a${attrs} target="_blank" rel="noreferrer">`;
	});
}
