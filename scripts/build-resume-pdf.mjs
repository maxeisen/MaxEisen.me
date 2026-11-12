// Render the résumé to public/MaxEisen_Resume.pdf.  `npm run resume:pdf`
//
// Builds the site, serves the build, and prints /resume in headless Chromium
// through the same print stylesheet a browser's own "Save as PDF" would use,
// so the file is exactly what printing the page gives. Then records the
// inputs' fingerprint (see lib/resumePdf.mjs) so the tests can tell when the
// committed PDF has fallen behind the résumé.
//
// The pre-commit hook (scripts/resume-pdf-hook.mjs) runs this for you when a
// commit changes public/content/resume.json, the résumé page, or the
// headshot, and adds the PDF and scripts/resume-pdf.lock.json to the commit.
// Run it by hand after a change the hook doesn't watch, like site-wide CSS.
// If the PDF falls behind, `npm run test:run` (and so the Netlify build)
// fails and says so.

import fs from "node:fs";
import { build, preview } from "vite";
import { chromium } from "@playwright/test";
import { ROOT, PDF_PATH, LOCK_PATH, inputFiles, inputsFingerprint, pdfPageCount } from "./lib/resumePdf.mjs";

const PORT = 6811;

process.chdir(ROOT);
// Errors only: the build's own warnings are about other pages.
await build({ logLevel: "error" });
const server = await preview({ preview: { port: PORT, strictPort: true, open: false }, logLevel: "error" });

let browser;
try {
	browser = await chromium.launch();
	const page = await browser.newPage();
	await page.emulateMedia({ media: "print", colorScheme: "light" });
	await page.goto(`http://localhost:${PORT}/resume`, { waitUntil: "networkidle" });
	await page.locator(".print-head h1").waitFor();
	await page.evaluate(() => document.fonts.ready);
	// The PDF's title, as a viewer shows it.
	await page.evaluate(() => { document.title = "Max Eisen — Résumé"; });

	const pdf = await page.pdf({ format: "Letter", preferCSSPageSize: true, printBackground: true });
	const pages = pdfPageCount(pdf);
	if (pages !== 1) {
		throw new Error(`The résumé printed to ${pages} pages; it has to fit one. Tighten public/content/resume.json or the print styles.`);
	}

	fs.writeFileSync(PDF_PATH, pdf);
	fs.writeFileSync(LOCK_PATH, `${JSON.stringify({
		note: "Written by scripts/build-resume-pdf.mjs. Fingerprint of the files below; tests/resumePdf.test.js checks it.",
		inputs: inputFiles(),
		fingerprint: inputsFingerprint(),
	}, null, "\t")}\n`);
	console.log(`Wrote ${PDF_PATH.replace(`${ROOT}/`, "")} (${Math.round(pdf.length / 1024)} KB, 1 page).`);
} finally {
	await browser?.close();
	await new Promise((resolve) => server.httpServer.close(resolve));
}
