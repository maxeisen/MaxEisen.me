import { test, expect } from "@playwright/test";

test("dashboard mounts its widget grid", async ({ page }) => {
	await page.goto("/dashboard");
	await expect(page).toHaveTitle(/Dashboard/i);

	const grid = page.locator("#dashboard-grid");
	await expect(grid).toBeVisible();

	// Widgets mount regardless of whether their data fetches succeed (each
	// renders a loading/empty shell), so the tiles are present even without a
	// backend. Assert "several" rather than an exact count to stay robust.
	const widgets = grid.locator(".widget");
	expect(await widgets.count()).toBeGreaterThanOrEqual(5);
});
