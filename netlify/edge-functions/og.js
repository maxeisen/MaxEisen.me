// Per-route social previews for the SPA.
//
// The app is a single-page app: every route is served the same index.html, so
// social crawlers (which don't run JS) only ever saw one hardcoded title +
// a broken relative og:image. This edge function runs server-side at the edge,
// rewrites the <head> of that HTML per route with the right title /
// description / Open Graph / Twitter tags, and points og:image at a dynamic,
// on-brand Cloudinary card (the page title rendered on a branded backdrop).
//
// String rewriting (not HTMLRewriter) so it's runtime-agnostic. The index.html
// meta tags are stable + ours, so the targeted replacements are safe.

const SITE_URL = "https://maxeisen.me";
const CLOUD = "https://res.cloudinary.com/meisen-gallery/image/upload";

const DEFAULT = {
	title: "Max Eisen — Software Engineer in Toronto",
	desc: "Software engineer in Toronto — projects, photo galleries, and what I'm up to.",
	card: "Max Eisen",
};

// path -> { title (document + og), desc, card (short text drawn on the image) }
const META = {
	"/": DEFAULT,
	"/gallery": { title: "Photo Galleries — Max Eisen", desc: "Photo galleries — cycling, running, and more.", card: "Galleries" },
	"/gallery/ride": { title: "Cycling — Max Eisen", desc: "Photos from the road, cycling around Toronto and beyond.", card: "Cycling" },
	"/gallery/run": { title: "Running — Max Eisen", desc: "Photos from runs around Toronto and beyond.", card: "Running" },
	"/dashboard": { title: "Live Dashboard — Max Eisen", desc: "A live look at what I'm listening to, riding, and reading.", card: "Live Dashboard" },
	"/toronto": { title: "My Toronto — Max Eisen", desc: "A personal map of my Toronto.", card: "My Toronto" },
	"/bach": { title: "Bach — Max Eisen", desc: "An interactive party game.", card: "Bach" },
	// Private + noindex: a neutral card so sharing the link never reveals photos.
	"/gallery/wedding": { title: "Max and Lara's Wedding", desc: "A private gallery of Max and Lara's wedding photos.", card: "Max and Lara's Wedding" },
};

// Cloudinary card: the short title in white serif over the branded backdrop,
// with a "MAXEISEN.ME" eyebrow. Mirrors the verified transform; commas/slashes
// inside the text are double-encoded as Cloudinary requires.
function cardUrl(text) {
	const enc = encodeURIComponent(text).replace(/%2C/g, "%252C").replace(/%2F/g, "%252F");
	const t = [
		"c_fill,h_630,w_1200",
		`c_fit,co_rgb:ffffff,l_text:Georgia_84_bold:${enc},w_980`,
		"fl_layer_apply,g_center,y_-8",
		"co_rgb:8fc7a9,l_text:Verdana_30_bold_letter_spacing_6:MAXEISEN.ME",
		"fl_layer_apply,g_south,y_66",
	].join("/");
	return `${CLOUD}/${t}/og/backdrop.png`;
}

const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Replace a <meta> tag's whole element (by its property/name); append if absent.
function setMeta(html, key, val, content) {
	const re = new RegExp(`<meta ${key}="${val}"[^>]*>`, "i");
	const tag = `<meta ${key}="${val}" content="${escAttr(content)}"/>`;
	return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `${tag}</head>`);
}

export default async function handler(request, context) {
	const res = await context.next();
	const ct = res.headers.get("content-type") || "";
	if (!ct.includes("text/html")) return res;

	const { pathname } = new URL(request.url);
	const m = META[pathname] || DEFAULT;
	const url = SITE_URL + pathname;
	const img = cardUrl(m.card);

	let html = await res.text();
	html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escText(m.title)}</title>`);
	html = setMeta(html, "property", "og:title", m.title);
	html = setMeta(html, "property", "og:description", m.desc);
	html = setMeta(html, "property", "og:url", url);
	html = setMeta(html, "property", "og:image", img);
	html = setMeta(html, "name", "description", m.desc);

	const extra = [
		`<meta property="og:image:width" content="1200"/>`,
		`<meta property="og:image:height" content="630"/>`,
		`<meta property="og:image:alt" content="${escAttr(m.title)}"/>`,
		`<meta name="twitter:card" content="summary_large_image"/>`,
		`<meta name="twitter:title" content="${escAttr(m.title)}"/>`,
		`<meta name="twitter:description" content="${escAttr(m.desc)}"/>`,
		`<meta name="twitter:image" content="${escAttr(img)}"/>`,
	].join("");
	html = html.replace("</head>", `${extra}</head>`);

	const headers = new Headers(res.headers);
	headers.delete("content-length");
	return new Response(html, { status: res.status, headers });
}

export const config = {
	path: ["/", "/gallery", "/gallery/ride", "/gallery/run", "/gallery/wedding", "/dashboard", "/toronto", "/bach"],
};
