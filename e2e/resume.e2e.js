import { test, expect } from "@playwright/test";

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
	await expect(page.getByRole("button", { name: "Save as PDF" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Resume" })).toHaveAttribute("aria-current", "page");
});

test("saving the résumé as a PDF gives exactly one page", async ({ page }) => {
	await page.goto("/resume");
	await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
	await page.emulateMedia({ media: "print" });
	const pdf = await page.pdf({ format: "Letter", preferCSSPageSize: true, printBackground: true });
	const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
	expect(pages).toBe(1);
});

test("the résumé fits a phone", async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 800 });
	await page.goto("/resume");
	await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
	expect(overflow).toBeLessThanOrEqual(0);
});
