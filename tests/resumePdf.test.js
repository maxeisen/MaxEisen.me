import fs from "node:fs";
import { describe, it, expect } from "vitest";
import { PDF_PATH, LOCK_PATH, inputsFingerprint, pdfPageCount } from "../scripts/lib/resumePdf.mjs";

/** A minimal PDF laid out the way Chrome writes one, with `pages` pages. */
function pdfWith(pages, { declared = pages } = {}) {
	const kids = Array.from({ length: pages }, (_, i) => `${i + 3} 0 R`).join(" ");
	const pageObjects = Array.from({ length: pages }, (_, i) =>
		`${i + 3} 0 obj\n<</Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]>>\nendobj`).join("\n");
	return Buffer.from([
		"%PDF-1.4",
		"1 0 obj\n<</Type /Catalog\n/Pages 2 0 R>>\nendobj",
		`2 0 obj\n<</Type /Pages\n/Count ${declared}\n/Kids [${kids}]>>\nendobj`,
		pageObjects,
		"%%EOF",
	].join("\n"), "latin1");
}

// The one-page checks are only as good as the counting: a counter that
// always said 1 would pass every one of them.
describe("pdfPageCount", () => {
	it("counts one page and several", () => {
		expect(pdfPageCount(pdfWith(1))).toBe(1);
		expect(pdfPageCount(pdfWith(3))).toBe(3);
	});

	it("refuses to guess when the page tree and the pages disagree", () => {
		expect(() => pdfPageCount(pdfWith(2, { declared: 1 }))).toThrow(/page count/);
		expect(() => pdfPageCount(Buffer.from("%PDF-1.4\n%%EOF"))).toThrow(/page count/);
	});
});

// The résumé's Save button hands over a committed PDF. These keep that file
// honest: it exists, it's one page, and it was made from the résumé as it
// stands. When the last one fails, run `npm run resume:pdf` and commit the
// PDF with scripts/resume-pdf.lock.json.
describe("the committed résumé PDF", () => {
	it("exists and is a single page", () => {
		const pdf = fs.readFileSync(PDF_PATH);
		expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
		expect(pdfPageCount(pdf)).toBe(1);
	});

	it("was generated from the résumé as it is now", () => {
		const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
		expect(
			lock.fingerprint,
			"The résumé changed since public/MaxEisen_Resume.pdf was made: run `npm run resume:pdf` and commit the PDF and scripts/resume-pdf.lock.json.",
		).toBe(inputsFingerprint());
	});
});
