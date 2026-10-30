// /cycling as HTML, for clients that never run the SPA.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHtmlResponder, cacheControl } from "./_shared/http.js";
import { createMemo } from "./_shared/memo.js";
import { loadCyclingDashboard, torontoToday } from "./_shared/training/dashboard.js";
import { injectCyclingFallback, renderCyclingFallback } from "./_shared/training/cyclingFallback.js";

const htmlResponse = createHtmlResponder(cacheControl.edgeBurst(60));
const errResponse = createHtmlResponder(cacheControl.none);
const memo = createMemo(60_000);

const SHELL_UNAVAILABLE = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Cycling — Max Eisen</title></head>
<body><p>Couldn't load the cycling dashboard right now.</p></body>
</html>`;

const GENERATED_SHELL = new URL("./_generated/spa-shell.html", import.meta.url);

export async function loadSpaShell() {
	if (process.env.NETLIFY_DEV === "true") {
		return readFile(join(process.cwd(), "index.html"), "utf8");
	}
	try {
		return await readFile(fileURLToPath(GENERATED_SHELL), "utf8");
	} catch {
		// Local runs and the first milliseconds of a deploy before the copy lands.
	}
	return readFile(join(process.cwd(), "index.html"), "utf8");
}

async function defaultPayload() {
	const today = torontoToday();
	return memo(`cycling:${today}`, () => loadCyclingDashboard(today));
}

export async function serveCyclingPage({ loadShell = loadSpaShell, loadPayload = defaultPayload } = {}) {
	let shell;
	try {
		shell = await loadShell();
	} catch (err) {
		console.error("cycling page shell failed", err);
		return errResponse(SHELL_UNAVAILABLE, 503);
	}
	try {
		const payload = await loadPayload();
		return htmlResponse(injectCyclingFallback(shell, renderCyclingFallback(payload)));
	} catch (err) {
		console.error("cycling page fallback failed", err);
		return htmlResponse(shell);
	}
}

export default async function handler() {
	return serveCyclingPage();
}
