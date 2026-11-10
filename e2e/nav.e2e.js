import { test, expect } from "@playwright/test";
import { mockDashboardFeeds } from "./fixtures/dashboardPayload.js";
import { buildTrainingFixture } from "./fixtures/trainingPayload.js";

// The nav bar is the same on every page, so moving between routes moves
// nothing in it. Some pages add controls of their own — the dashboard and
// galleries a button that hides the bar, the dashboard and activity pages
// the layout Edit toggle — and none of them may move anything in the row.
// Each is compared against /resume, which has none.

async function navLayout(page, path) {
	await page.goto(path);
	const links = page.locator('header.site-nav nav a');
	await expect(links.first()).toBeVisible();
	const boxes = await links.evaluateAll((els) => els.map((el) => {
		const r = el.getBoundingClientRect();
		return { text: el.textContent, x: Math.round(r.x), w: Math.round(r.width) };
	}));
	const theme = await page.locator("header.site-nav .tools > :not(.hide)").last().boundingBox();
	return { boxes, theme };
}

test.beforeEach(async ({ page }) => {
	await mockDashboardFeeds(page);
	const training = buildTrainingFixture();
	await page.route("**/.netlify/functions/trainingData*", (route) =>
		route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(training) }),
	);
});

for (const width of [1920, 1280, 1100, 900, 760, 390]) {
	test(`the nav's links sit in the same place on every page at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 800 });
		const plain = await navLayout(page, "/resume");
		for (const path of ["/dashboard", "/running", "/gallery"]) {
			const layout = await navLayout(page, path);
			expect(layout.boxes, path).toEqual(plain.boxes);
			expect(layout.theme, path).toEqual(plain.theme);
		}
	});

	test(`the hide control moves nothing in the nav at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 800 });
		const plain = await navLayout(page, "/resume");
		const withHide = await navLayout(page, "/gallery");
		expect(withHide.boxes).toEqual(plain.boxes);

		const hide = page.getByRole("button", { name: "Hide navigation" });
		// Below 700px there's no room for it outside the row, so it isn't offered.
		if (width <= 700) {
			await expect(hide).toBeHidden();
			return;
		}
		await expect(hide).toBeVisible();
		const box = await hide.boundingBox();
		// Right of the theme toggle, clear of it, and on screen.
		expect(box.x).toBeGreaterThanOrEqual(withHide.theme.x + withHide.theme.width);
		expect(box.x + box.width).toBeLessThanOrEqual(width);
	});
}

test("the floating Edit toggle stays clear of the dashboard's widgets", async ({ page }) => {
	for (const [width, height] of [[1440, 900], [960, 600], [1920, 1080]]) {
		await page.setViewportSize({ width, height });
		await page.goto("/dashboard");
		const toggle = page.getByRole("button", { name: "Toggle layout edit mode" });
		await expect(toggle).toBeVisible();
		await expect(page.locator("#dashboard-grid .widget").first()).toBeVisible();
		const pill = await toggle.boundingBox();
		const lowest = await page.locator("#dashboard-grid .widget:visible").evaluateAll(
			(els) => Math.max(...els.map((el) => el.getBoundingClientRect().bottom)),
		);
		const fits = await page.locator("#dashboard-grid").getAttribute("data-fit");
		// When the grid fits the window, nothing is below the pill to scroll
		// out from under it, so it must clear every widget.
		if (fits === "true") expect(pill.y, `${width}×${height}`).toBeGreaterThanOrEqual(lowest);
	}
});

test("Edit is still there with the dashboard's nav tucked away", async ({ page }) => {
	await page.goto("/dashboard");
	await page.getByRole("button", { name: "Hide navigation" }).click();
	await expect(page.locator("header.site-nav")).toHaveCount(0);
	const toggle = page.getByRole("button", { name: "Toggle layout edit mode" });
	await toggle.click();
	await expect(page.getByRole("group", { name: "Widgets to show" })).toBeVisible();
});

test("a gallery's nav can be hidden and brought back", async ({ page }) => {
	await page.goto("/gallery");
	await page.getByRole("button", { name: "Hide navigation" }).click();
	await expect(page.locator("header.site-nav")).toHaveCount(0);
	await page.reload();
	await expect(page.locator("header.site-nav")).toHaveCount(0);
	await page.getByRole("button", { name: "Show navigation" }).click();
	await expect(page.locator("header.site-nav")).toBeVisible();
});
