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

import { raceAhead } from "../functions/_shared/training/plan.js";
import { trainingPageMeta } from "../../src/components/Training/lib/block.js";

const SITE_URL = "https://maxeisen.me";
const CLOUD = "https://res.cloudinary.com/meisen-gallery/image/upload";

const DEFAULT = {
	title: "Max Eisen — Software Engineer",
	desc: "A Toronto-based Software Engineer — my work, photo galleries, and what I'm up to.",
	card: "Software engineer in Toronto",
};

// path -> { title (document + og), desc, card (short text drawn on the image) }
const META = {
	"/": DEFAULT,
	"/gallery": { title: "Gallery — Max Eisen", desc: "A gallery of photos taken with my Fujifilm X100S and X100V.", card: "Gallery" },
	"/gallery/ride": { title: "Cycling — Max Eisen", desc: "Photos from the road, cycling around Toronto and beyond.", card: "Cycling" },
	"/gallery/run": { title: "Running — Max Eisen", desc: "Photos from runs around Toronto and beyond.", card: "Running" },
	"/dashboard": { title: "Live Dashboard — Max Eisen", desc: "A live look at what I'm listening to, riding, and reading.", card: "Live Dashboard" },
	"/cycling": { title: "Cycling — Max Eisen", desc: "A ride log: fitness, fatigue, and the last ride. Not a race plan.", card: "Cycling" },
	"/bach": { title: "Bach — Max Eisen", desc: "An interactive party game.", card: "Bach" },
	"/resume": { title: "Resume — Max Eisen", desc: "Max Eisen's résumé — software engineer in Toronto.", card: "Resume" },
	// Private + noindex: a neutral card so sharing the link never reveals photos.
	"/gallery/wedding": { title: "Max and Lara's Wedding", desc: "A private gallery of Max and Lara's wedding photos.", card: "Max and Lara's Wedding" },
};

// Cloudinary card, in the site's style: flat ink, the "me." mark and name
// top-left, the page title large and left-aligned, the domain under it.
// Built entirely from transformations on og/backdrop (recoloured flat), so a
// new card needs nothing uploaded. Text that contains commas or slashes is
// double-encoded, as Cloudinary requires.
//
// CARD_FONT is the closest face Cloudinary draws by name — it doesn't carry
// Inter. Upload Inter as a raw font asset (e.g. "Inter-SemiBold.ttf") and put
// its public id here to use the real thing.
const CARD_FONT = "Roboto";
const INK = "12110f";
const PAPER = "f4efe6";
const SAGE = "52683f";
const MUTED = "aaa192";

function cardText(text) {
	return encodeURIComponent(text).replace(/%2C/g, "%252C").replace(/%2F/g, "%252F");
}

export function cardUrl(text) {
	const f = CARD_FONT;
	const t = [
		"c_fill,h_630,w_1200",
		`e_colorize:100,co_rgb:${INK}`,
		// The mark: a paper square, "me" in ink, the period in sage.
		"l_og:backdrop",
		"c_fill,w_88,h_88",
		`e_colorize:100,co_rgb:${PAPER}`,
		"r_20",
		"fl_layer_apply,g_north_west,x_80,y_72",
		`co_rgb:${INK},l_text:${f}_46_bold_letter_spacing_-2:me`,
		"fl_layer_apply,g_north_west,x_90,y_103",
		`co_rgb:${SAGE},l_text:${f}_46_bold:.`,
		"fl_layer_apply,g_north_west,x_149,y_122",
		`co_rgb:${PAPER},l_text:${f}_36_bold:Max%20Eisen`,
		"fl_layer_apply,g_north_west,x_192,y_99",
		// The title, wrapping onto a second line when it needs to.
		`c_fit,w_1040,co_rgb:${PAPER},l_text:${f}_112_bold_letter_spacing_-4_line_spacing_-18:${cardText(text)}`,
		"fl_layer_apply,g_south_west,x_76,y_164",
		`co_rgb:${MUTED},l_text:${f}_32:maxeisen.me`,
		"fl_layer_apply,g_south_west,x_80,y_84",
	].join("/");
	return `${CLOUD}/${t}/og/backdrop.png`;
}

const EMPTY_PLAN = { race: {}, thresholds: {}, weeks: [] };

// Edge has no filesystem. The plan is a static asset, so a missing file is a
// 404 and the card is the running log — same rule as planFile.js on Node.
async function loadCurrentPlan(request) {
	try {
		const res = await fetch(new URL("/content/running/current-plan.json", request.url));
		if (!res.ok) return EMPTY_PLAN;
		const json = await res.json();
		if (!json || typeof json !== "object" || Array.isArray(json)) return EMPTY_PLAN;
		return {
			race: json.race && typeof json.race === "object" && !Array.isArray(json.race) ? json.race : {},
			thresholds: json.thresholds && typeof json.thresholds === "object" && !Array.isArray(json.thresholds) ? json.thresholds : {},
			weeks: Array.isArray(json.weeks) ? json.weeks : [],
		};
	} catch {
		return EMPTY_PLAN;
	}
}

// Same switch as the page: a race still ahead keeps its card, otherwise this is just running.
async function trainingMeta(request) {
	const plan = await loadCurrentPlan(request);
	const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
	return trainingPageMeta({ inBlock: raceAhead(plan, today), race: plan.race });
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
	const m = pathname === "/running" ? await trainingMeta(request) : (META[pathname] || DEFAULT);
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
	path: ["/", "/gallery", "/gallery/ride", "/gallery/run", "/gallery/wedding", "/dashboard", "/running", "/cycling", "/bach", "/resume"],
};
