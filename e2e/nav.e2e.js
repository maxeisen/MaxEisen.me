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
		await expect(hide).toBeVisible();
		const box = await hide.boundingBox();

		// It covers nothing in the row.
		const items = await page.locator("header.site-nav nav a, header.site-nav .home, header.site-nav .tools > *")
			.evaluateAll((els) => els.map((el) => {
				const r = el.getBoundingClientRect();
				return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
			}));
		for (const r of items) {
			const overlaps = r.left < box.x + box.width && r.right > box.x && r.top < box.y + box.height && r.bottom > box.y;
			expect(overlaps).toBe(false);
		}

		// Hide and show are the same spot: click, and click again without
		// moving the pointer.
		const spot = { x: box.x + box.width / 2, y: box.y + Math.min(box.height, 8) / 2 + 1 };
		await page.mouse.click(spot.x, spot.y);
		await expect(page.locator("header.site-nav")).toHaveCount(0);
		await page.mouse.click(spot.x, spot.y);
		await expect(page.locator("header.site-nav")).toBeVisible();
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

// The page you're on is marked by one highlight shape: behind the logo and
// name on the homepage, behind the section's link elsewhere. Moving between
// pages slides it from the old spot to the new one.
// During the page cross-fade the old page's bar is still there, so these
// look at the newest one.
const bar = (page) => page.locator("header.site-nav").last();
async function pillBox(page) {
	return bar(page).locator(".pill").boundingBox();
}

test("the highlight sits behind the logo on the homepage and slides to the page you open", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto("/");
	const home = page.locator("header.site-nav .home");
	await expect(home).toHaveAttribute("aria-current", "page");
	const homeBox = await home.boundingBox();
	const start = await pillBox(page);
	expect(start.x).toBeLessThan(homeBox.x);
	expect(start.x + start.width).toBeGreaterThan(homeBox.x + homeBox.width);

	await bar(page).locator("nav a", { hasText: "Resume" }).click();
	await expect(page).toHaveURL(/\/resume$/);
	await expect(page.locator("header.site-nav")).toHaveCount(1);
	const link = bar(page).locator("nav a", { hasText: "Resume" });
	await expect(link).toHaveAttribute("aria-current", "page");

	// It slides (the transition is on) rather than jumping, and ends on the link.
	await expect(bar(page).locator(".pill")).toHaveClass(/animate/);
	const linkBox = await link.boundingBox();
	await expect.poll(async () => {
		const b = await pillBox(page);
		return b && Math.round(b.x) === Math.round(linkBox.x) && Math.round(b.width) === Math.round(linkBox.width);
	}).toBe(true);
});

test("a fresh load puts the highlight straight on the current link", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto("/running");
	const link = page.locator("header.site-nav nav a", { hasText: "Running" });
	await expect(link).toHaveAttribute("aria-current", "page");
	await expect(page.locator("header.site-nav .home")).not.toHaveAttribute("aria-current", "page");
	await expect(page.locator("header.site-nav .pill")).not.toHaveClass(/animate/);
	const linkBox = await link.boundingBox();
	const b = await pillBox(page);
	expect(Math.round(b.x)).toBe(Math.round(linkBox.x));
	expect(Math.round(b.width)).toBe(Math.round(linkBox.width));
});
