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

// The drag and its edit mode are shared with /training (lib/ui/reorder and
// lib/ui/editMode), so the behaviour is asserted on both pages: this is where
// it came from, and it's the one that mustn't change.
test("a widget can be dragged into another slot, and stays there", async ({ page }) => {
	await page.goto("/dashboard");
	const widgetAt = (idx) => page.locator(`[data-slot-index="${idx}"] .widget`);

	const first = await widgetAt(0).getAttribute("data-widget");
	const fifth = await widgetAt(4).getAttribute("data-widget");

	const source = await widgetAt(0).boundingBox();
	const target = await page.locator('[data-slot-index="4"]').boundingBox();
	await page.mouse.move(source.x + source.width / 2, source.y + 24);
	await page.mouse.down();
	await page.mouse.move(target.x + target.width / 2, target.y + 24, { steps: 14 });
	await page.mouse.up();

	await expect(widgetAt(4)).toHaveAttribute("data-widget", first);
	await expect(widgetAt(0)).toHaveAttribute("data-widget", fifth);

	await page.reload();
	await expect(widgetAt(4)).toHaveAttribute("data-widget", first);
});

test("the edit toggle is a small-screen affair", async ({ page }) => {
	await page.goto("/dashboard");
	const toggle = page.getByRole("button", { name: "Toggle layout edit mode" });
	await expect(toggle).toHaveCount(0);

	await page.setViewportSize({ width: 390, height: 844 });
	await expect(toggle).toBeVisible();
	await expect(toggle).toHaveText(/Edit/);
	await toggle.click();
	await expect(toggle).toHaveText(/Done/);
});
