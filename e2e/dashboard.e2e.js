import { test, expect } from "@playwright/test";
import { mockDashboardFeeds } from "./fixtures/dashboardPayload.js";

test("dashboard mounts its widget grid", async ({ page }) => {
	await mockDashboardFeeds(page);
	await page.goto("/dashboard");
	await expect(page).toHaveTitle(/Dashboard/i);

	const grid = page.locator("#dashboard-grid");
	await expect(grid).toBeVisible();

	// Feeds are stubbed: without them most widgets would (rightly) step
	// aside, which is tested on its own below.
	await expect(grid.locator(".widget:visible")).toHaveCount(7);
});

// The drag and its edit mode are shared with /running (lib/ui/reorder and
// lib/ui/editMode), so the behaviour is asserted on both pages: this is where
// it came from, and it's the one that mustn't change.
test("a widget can be dragged into another slot, and stays there", async ({ page }) => {
	await mockDashboardFeeds(page);
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

test("edit mode hides a widget, and the customize bar brings it back", async ({ page }) => {
	await mockDashboardFeeds(page);
	await page.goto("/dashboard");
	const grid = page.locator("#dashboard-grid");
	const hn = grid.locator('[data-widget="hn"]');
	await expect(hn).toBeVisible();

	const toggle = page.getByRole("button", { name: "Toggle layout edit mode" });
	await toggle.click();
	await page.getByRole("button", { name: "Hide Hacker News" }).click();
	await expect(hn).toHaveCount(0);

	// Hidden survives a reload, and isn't fetched while hidden.
	let hnFetched = false;
	page.on("request", (req) => {
		if (req.url().includes("hacker-news.firebaseio.com")) hnFetched = true;
	});
	await page.reload();
	await expect(grid.locator(".widget").first()).toBeVisible();
	await expect(hn).toHaveCount(0);
	expect(hnFetched).toBe(false);

	await toggle.click();
	const chip = page.getByRole("group", { name: "Widgets to show" }).getByRole("button", { name: "Hacker News" });
	await expect(chip).toHaveAttribute("aria-pressed", "false");
	await chip.click();
	await expect(hn).toBeVisible();
	await expect(chip).toHaveAttribute("aria-pressed", "true");
});

test("a widget whose feed fails steps aside, and says so in edit mode", async ({ page }) => {
	await mockDashboardFeeds(page);
	// Registered after the fixtures, so it wins for this one feed.
	await page.route("**/.netlify/functions/githubLatest*", (r) => r.fulfill({ status: 500, body: "nope" }));
	await page.goto("/dashboard");

	const grid = page.locator("#dashboard-grid");
	await expect(grid.locator('[data-widget="hn"]')).toBeVisible();
	await expect(grid.locator('[data-widget="github"]')).toBeHidden();
	await expect(grid.locator(".widget:visible")).toHaveCount(6);

	// It's still chosen, just not loading: edit mode says which.
	await page.getByRole("button", { name: "Toggle layout edit mode" }).click();
	const chip = page.getByRole("group", { name: "Widgets to show" }).getByRole("button", { name: /^Code/ });
	await expect(chip).toHaveAttribute("aria-pressed", "true");
	await expect(chip).toContainText("unavailable");

	// Not remembered: a visit where the feed works shows it again.
	await page.unroute("**/.netlify/functions/githubLatest*");
	await mockDashboardFeeds(page);
	await page.reload();
	await expect(grid.locator('[data-widget="github"]')).toBeVisible();
});

test("hiding every widget leaves a way back", async ({ page }) => {
	await mockDashboardFeeds(page);
	await page.goto("/dashboard");
	await page.evaluate(() => {
		const ids = ["clock", "gallery", "weather", "spotify", "strava", "github", "hn"];
		localStorage.setItem("dashboard-widgets", JSON.stringify(Object.fromEntries(ids.map((id) => [id, false]))));
	});
	await page.reload();
	await expect(page.getByText("Every widget is hidden.")).toBeVisible();
	await page.getByRole("button", { name: "Choose widgets" }).click();
	await page.getByRole("button", { name: "Reset layout" }).click();
	await expect(page.locator("#dashboard-grid .widget")).toHaveCount(7);
});

// The dashboard is often a window squeezed into part of a screen, so the
// layout is checked at awkward sizes as well as common ones: every widget's
// content has to stay inside its tile, and a grid that claims to fit the
// window mustn't scroll.
const SIZES = [
	[2560, 1440], [2560, 700], [1920, 1080], [1700, 600], [1440, 900],
	[1280, 720], [1280, 400], [1100, 700], [960, 1050], [960, 520],
	[700, 900], [600, 1300], [390, 844],
];

for (const [width, height] of SIZES) {
	test(`widgets fit their tiles at ${width}×${height}`, async ({ page }) => {
		await page.setViewportSize({ width, height });
		await mockDashboardFeeds(page);
		await page.goto("/dashboard");
		await expect(page.locator(".github-repo")).toBeVisible();
		await expect(page.locator(".hn-item").first()).toBeVisible();
		await expect(page.locator(".strava-row").first()).toBeVisible();
		await expect(page.locator(".weather-temp")).toHaveText("21°");
		// List trimming runs a frame after a resize; give it a couple.
		await page.waitForTimeout(250);

		const report = await page.evaluate(() => {
			const overflows = [];
			for (const widget of document.querySelectorAll("#dashboard-grid .widget")) {
				const box = widget.getBoundingClientRect();
				for (const el of widget.querySelectorAll("*")) {
					// An SVG's children are drawn in its viewBox; the <svg> itself is checked.
					if (el.ownerSVGElement) continue;
					const style = getComputedStyle(el);
					if (style.visibility === "hidden") continue;
					const r = el.getBoundingClientRect();
					if (r.width === 0 && r.height === 0) continue;
					const over = Math.max(r.bottom - box.bottom, r.right - box.right, box.top - r.top, box.left - r.left);
					if (over > 1) {
						overflows.push(`${widget.dataset.widget}: .${[...el.classList].join(".") || el.tagName} by ${Math.round(over)}px`);
					}
				}
			}
			const fit = document.querySelector(".dashboard-fit");
			const grid = document.querySelector("#dashboard-grid");
			return {
				overflows,
				fits: grid.dataset.fit === "true",
				fitScrolls: fit.scrollHeight > fit.clientHeight + 1,
				pageScrollsX: document.documentElement.scrollWidth > window.innerWidth,
			};
		});

		expect(report.overflows).toEqual([]);
		expect(report.pageScrollsX).toBe(false);
		if (report.fits) expect(report.fitScrolls).toBe(false);
	});
}
