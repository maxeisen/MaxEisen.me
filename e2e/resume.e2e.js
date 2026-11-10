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

// Printing lays the page out in the light scheme, which the browser reports
// as a prefers-color-scheme change. The page used to follow it: the screen
// went light and stayed light (and "light" was saved as the theme). A real
// print dialog can't be opened here, so this reproduces what one does: the
// beforeprint/afterprint pair, with the scheme flipping to light between.
test("printing doesn't change the theme on screen", async ({ page }) => {
	await page.emulateMedia({ colorScheme: "dark" });
	await page.goto("/resume");
	const theme = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
	const saved = () => page.evaluate(() => localStorage.getItem("theme"));
	expect(await theme()).toBe("dark");

	await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
	await page.emulateMedia({ colorScheme: "light" });
	await page.waitForTimeout(100);
	expect(await theme()).toBe("dark");

	await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
	await page.emulateMedia({ colorScheme: "dark" });
	expect(await theme()).toBe("dark");
	expect(await saved()).toBe("dark");
});

test("a real change to the system scheme still switches the theme", async ({ page }) => {
	await page.emulateMedia({ colorScheme: "dark" });
	await page.goto("/resume");
	await page.emulateMedia({ colorScheme: "light" });
	await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("light");
});
