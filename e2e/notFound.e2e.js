import { test, expect } from "@playwright/test";

// 404.html is a standalone page (netlify.toml sends unknown paths to it), so
// vite preview serves it at its own path rather than for a missing route.

for (const javaScriptEnabled of [true, false]) {
	test.describe(javaScriptEnabled ? "with JavaScript" : "without JavaScript", () => {
		test.use({ javaScriptEnabled });

		test("the 404 page says what happened and where to go", async ({ page }) => {
			await page.goto("/404.html");
			await expect(page).toHaveTitle(/Page not found/);
			await expect(page.getByRole("heading", { level: 1, name: "This page doesn't exist" })).toBeVisible();
			await expect(page.getByRole("link", { name: "Go to the homepage" })).toHaveAttribute("href", "/");
			for (const href of ["/resume", "/gallery", "/running", "/cycling", "/dashboard"]) {
				await expect(page.locator(`.places a[href="${href}"]`)).toBeVisible();
			}
		});
	});
}

test("the 404 page follows the saved theme", async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("theme", "dark"));
	await page.goto("/404.html");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("the 404 page fits a phone", async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 800 });
	await page.goto("/404.html");
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
	expect(overflow).toBeLessThanOrEqual(0);
});
