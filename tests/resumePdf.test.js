import fs from "node:fs";
import { describe, it, expect } from "vitest";
import { PDF_PATH, LOCK_PATH, inputsFingerprint, pdfPageCount } from "../scripts/lib/resumePdf.mjs";

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
