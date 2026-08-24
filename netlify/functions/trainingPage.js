// /training as HTML, for browsers that never run the SPA.
//
// The rewrite in netlify.toml sends this path here instead of index.html. The
// response is still that shell — hashed scripts, theme, the empty #app — with
// the dashboard rendered into <noscript> from the same payload trainingData
// serves as JSON. JS visitors boot the app and never see the fallback; a
// payload failure fails open so they still get the shell.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHtmlResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { loadDashboard, torontoToday } from "./_shared/training/dashboard.js";
import { injectTrainingFallback, renderTrainingFallback } from "./_shared/training/fallback.js";

const htmlResponse = createHtmlResponder(cacheControl.edgeBurst(60));
const errResponse = createHtmlResponder(cacheControl.none);
const memo = createMemo(60_000);

const SHELL_UNAVAILABLE = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Training — Max Eisen</title></head>
<body><p>Couldn't load the training dashboard right now.</p></body>
</html>`;

// Copied from dist/index.html after vite build (see scripts/copy-spa-shell.mjs)
// so production injects into the hashed document, not the source one.
const GENERATED_SHELL = new URL("./_generated/spa-shell.html", import.meta.url);

/**
 * The built SPA document. Prefer the hashed shell copied at deploy time, then
 * a fetch of the published index.html, then the source index.html.
 *
 * Dist is skipped on purpose: a leftover `dist/` during `netlify dev` would
 * inject hashed `/build/*` scripts that vite isn't serving, and the app would
 * boot blank. Local dev always wants the source shell (`/src/main.js`).
 */
export async function loadSpaShell() {
	if (process.env.NETLIFY_DEV === "true") {
		return readFile(join(process.cwd(), "index.html"), "utf8");
	}

	try {
		return await readFile(fileURLToPath(GENERATED_SHELL), "utf8");
	} catch {
		// Local runs and the first milliseconds of a deploy before the copy lands.
	}

	const origin = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");
	if (origin) {
		try {
			const res = await fetch(`${origin}/index.html`);
			if (res.ok) return await res.text();
		} catch {
			// Fall through to the source shell.
		}
	}

	return readFile(join(process.cwd(), "index.html"), "utf8");
}

async function defaultPayload() {
	const today = torontoToday();
	return memo(`dashboard:${today}`, () => loadDashboard(today));
}

/**
 * @param {{ loadShell?: () => Promise<string>, loadPayload?: () => Promise<object> }} [deps]
 */
export async function serveTrainingPage({ loadShell = loadSpaShell, loadPayload = defaultPayload } = {}) {
	let shell;
	try {
		shell = await loadShell();
	} catch (err) {
		console.error("training page shell failed", err);
		return errResponse(SHELL_UNAVAILABLE, 503);
	}

	try {
		const payload = await loadPayload();
		return htmlResponse(injectTrainingFallback(shell, renderTrainingFallback(payload)));
	} catch (err) {
		console.error("training page fallback failed", err);
		return htmlResponse(shell);
	}
}

export default async function handler() {
	return serveTrainingPage();
}
