import { test, expect } from "@playwright/test";

// /blog lists the posts and each post has its own page at /blog/<slug>. The
// blog is reachable by URL but not in the nav yet, and asks search engines
// not to index it.

test("the blog lists posts, newest first, and stays out of the nav", async ({ page }) => {
	await page.goto("/blog");
	await expect(page).toHaveTitle("Blog — Max Eisen");
	await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();
	const titles = page.locator(".posts .title");
	await expect(titles).toHaveText(["My Sense of Design", "Creating the Blog Component"]);
	await expect(page.locator(".site-nav").getByRole("link", { name: "Blog" })).toHaveCount(0);
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
});

test("a post opens from the list without a full reload and renders its Markdown", async ({ page }) => {
	await page.goto("/blog");
	await page.evaluate(() => { window.__sameDocument = true; });
	await page.getByRole("link", { name: /My Sense of Design/ }).click();
	await expect(page).toHaveURL("/blog/sense-of-design");
	expect(await page.evaluate(() => window.__sameDocument)).toBe(true);

	await expect(page).toHaveTitle("My Sense of Design — Max Eisen");
	await expect(page.getByRole("heading", { level: 1, name: "My Sense of Design" })).toBeVisible();
	await expect(page.getByRole("heading", { level: 2, name: "Foreword" })).toBeVisible();
	await expect(page.getByText(/min read/)).toBeVisible();
	await expect(page.getByText("Updated May 14, 2021")).toBeVisible();
	await expect(page.locator(".note")).toContainText("Written in 2021");
	await expect(page.locator(".prose")).not.toContainText("title:");

	const img = page.getByRole("img", { name: "Apple eMac" });
	await img.scrollIntoViewIfNeeded();
	await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);

	await page.getByRole("link", { name: /Older.*Creating the Blog Component/ }).click();
	await expect(page.getByRole("heading", { level: 1, name: "Creating the Blog Component" })).toBeVisible();
	// The old post fades out alongside the new one for a moment.
	await expect(page.getByRole("link", { name: "All posts" })).toHaveCount(1);
	await page.getByRole("link", { name: "All posts" }).click();
	await expect(page).toHaveURL("/blog");
});

test("a post URL with no post goes to the 404 page", async ({ page }) => {
	await page.goto("/blog/no-such-post");
	await expect(page).toHaveURL(/\/404\.html$/);
});

test("a post fits a phone", async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 800 });
	await page.goto("/blog/creating-the-blog-component");
	await expect(page.locator(".prose")).toBeVisible();
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
	expect(overflow).toBeLessThanOrEqual(0);
});
