import fs from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { pdfPageCount } from "../scripts/lib/resumePdf.mjs";

// The résumé is an SPA route now, not a standalone resume.html. It has to
// render its content on screen, and printing it ("Save as PDF") has to give a
// single page — a recruiter's PDF that spills a line onto page two looks
// careless, and nothing on screen would warn you it had happened.

test("the résumé renders as a page of the site", async ({ page }) => {
	await page.goto("/resume");
	await expect(page).toHaveTitle(/Resume/);
	await expect(page.getByRole("heading", { level: 1, name: "Max Eisen" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Education" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Save as PDF" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Resume" })).toHaveAttribute("aria-current", "page");
});

// "Save as PDF" hands over a committed file rather than opening the print
// dialog (which does nothing in the home-screen app on iOS), so the same
// thing happens on every device.
test("Save as PDF downloads the résumé as a one-page PDF", async ({ page }) => {
	await page.goto("/resume");
	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByRole("link", { name: "Save as PDF" }).click(),
	]);
	expect(download.suggestedFilename()).toBe("MaxEisen_Resume.pdf");
	const bytes = await fs.readFile(await download.path());
	expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
	expect(pdfPageCount(bytes)).toBe(1);
});

test("Save as PDF is the same link on a phone", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/resume");
	const link = page.getByRole("link", { name: "Save as PDF" });
	await expect(link).toBeVisible();
	await expect(link).toHaveAttribute("href", "/MaxEisen_Resume.pdf");
	const res = await page.request.get("/MaxEisen_Resume.pdf");
	expect(res.status()).toBe(200);
	expect(res.headers()["content-type"]).toContain("pdf");
});

// The print stylesheet is what the committed PDF (and anyone's own Print) is
// made from, so it still has to fit one page.
test("printing the résumé gives exactly one page", async ({ page }) => {
	await page.goto("/resume");
	await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
	await page.emulateMedia({ media: "print" });
	const pdf = await page.pdf({ format: "Letter", preferCSSPageSize: true, printBackground: true });
	expect(pdfPageCount(pdf)).toBe(1);
});

// And the check can actually fail: with the type blown up so the résumé
// spills, the same print counts more than one page.
test("a résumé that spills onto a second page is caught", async ({ page }) => {
	await page.goto("/resume");
	await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
	await page.emulateMedia({ media: "print" });
	await page.addStyleTag({ content: "@media print { .sheet { font-size: 16pt !important; } .bullets li { font-size: 14pt !important; } }" });
	const pdf = await page.pdf({ format: "Letter", preferCSSPageSize: true, printBackground: true });
	expect(pdfPageCount(pdf)).toBeGreaterThan(1);
});

test("the résumé fits a phone", async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 800 });
	await page.goto("/resume");
	await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
	expect(overflow).toBeLessThanOrEqual(0);
});
