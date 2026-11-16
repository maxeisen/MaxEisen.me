import { test, expect } from "@playwright/test";
import { mockDashboardFeeds } from "./fixtures/dashboardPayload.js";

test("dashboard mounts its widget grid", async ({ page }) => {
	await mockDashboardFeeds(page);
	await page.goto("/dashboard");
	await expect(page).toHaveTitle("Dashboard — Max Eisen");

	const grid = page.locator("#dashboard-grid");
	await expect(grid).toBeVisible();

	// Feeds are stubbed: without them most widgets would (rightly) step
	// aside, which is tested on its own below.
	await expect(grid.locator(".widget:visible")).toHaveCount(12);
});

// Dragging previews where a widget will land and puts it there. The edit
// mode that gates it on touch screens is shared with /running.
test("a dragged widget lands where it's dropped, and stays there", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockDashboardFeeds(page);
	await page.goto("/dashboard");
	await expect(page.locator(".github-repo")).toBeVisible();

	const clock = page.locator('[data-widget="clock"]');
	const github = page.locator('[data-widget="github"]');
	const from = await clock.boundingBox();
	const target = await github.boundingBox();
	const cellOf = (locator) => locator.evaluate((el) => {
		const style = getComputedStyle(el);
		return { col: Number(style.gridColumnStart), row: Number(style.gridRowStart) };
	});
	const was = await cellOf(github.locator("xpath=.."));

	// Pick the clock up near its top-left and carry that corner to GitHub's.
	await page.mouse.move(from.x + 30, from.y + 30);
	await page.mouse.down();
	await page.mouse.move(target.x + 30, target.y + 30, { steps: 16 });

	// Mid-drag, a placeholder shows the landing spot: GitHub's old cell, or
	// one next to it. (Lifting the clock out moves everything after it, so
	// an exact landing isn't always possible without leaving a gap.) Judged
	// in grid cells, since a preview can change how tall the rows are.
	const placeholder = page.locator(".drop-placeholder");
	await expect(placeholder).toBeVisible();
	const now = await cellOf(placeholder);
	expect(Math.abs(now.col - was.col) + Math.abs(now.row - was.row)).toBeLessThanOrEqual(1);
	const landing = await placeholder.boundingBox();
	// …and it's somewhere new.
	expect(Math.abs(landing.x - from.x) + Math.abs(landing.y - from.y)).toBeGreaterThan(50);

	await page.mouse.up();
	await expect(placeholder).toHaveCount(0);
	// Once the glide into place has finished, it's in the placeholder's cell.
	// Judged in cells, not pixels: while dragging, the grid drops its
	// reserved scrollbar gutter (so a tile can leave it), which shifts every
	// column but the first by the gutter's width with classic scrollbars.
	await expect.poll(() => clock.evaluate((el) => el.getAnimations().length)).toBe(0);
	expect(await cellOf(clock.locator("xpath=.."))).toEqual(now);
	const dropped = await clock.boundingBox();

	// After a reload it's there from the first frame: no glide in from the
	// default layout.
	await page.reload();
	await expect(page.locator(".github-repo")).toBeVisible();
	const reloaded = await clock.boundingBox();
	expect(Math.abs(reloaded.x - dropped.x)).toBeLessThan(4);
	expect(Math.abs(reloaded.y - dropped.y)).toBeLessThan(4);
	expect(await clock.evaluate((el) => el.getAnimations().length)).toBe(0);
});

test("Escape puts a drag back", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockDashboardFeeds(page);
	await page.goto("/dashboard");
	await expect(page.locator(".github-repo")).toBeVisible();

	const clock = page.locator('[data-widget="clock"]');
	const from = await clock.boundingBox();
	const target = await page.locator('[data-widget="github"]').boundingBox();
	await page.mouse.move(from.x + 30, from.y + 30);
	await page.mouse.down();
	await page.mouse.move(target.x + 30, target.y + 30, { steps: 10 });
	await expect(page.locator(".drop-placeholder")).toBeVisible();
	await page.keyboard.press("Escape");
	await page.mouse.up();

	await expect(page.locator(".drop-placeholder")).toHaveCount(0);
	await page.waitForTimeout(300);
	const after = await clock.boundingBox();
	expect(Math.abs(after.x - from.x)).toBeLessThan(4);
	expect(Math.abs(after.y - from.y)).toBeLessThan(4);
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
	await expect(grid.locator(".widget:visible")).toHaveCount(11);

	// It's still chosen, just not loading: edit mode says which.
	await page.getByRole("button", { name: "Toggle layout edit mode" }).click();
	const chip = page.getByRole("group", { name: "Widgets to show" }).getByRole("button", { name: /^Code/ });
	await expect(chip).toHaveAttribute("aria-pressed", "true");
	await expect(chip).toContainText("unavailable");

	// …and offers a hidden widget to take its place.
	await page.getByRole("button", { name: "Show World clocks in its place" }).click();
	await expect(grid.locator('[data-widget="clocks"]')).toBeVisible();
	await expect(chip).toHaveAttribute("aria-pressed", "false");
	await chip.click(); // back on, for the reload below

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
		const ids = ["clock", "weather", "running", "cycling", "spotify", "forecast", "recovery", "week", "strava", "github", "gallery", "hn", "clocks"];
		localStorage.setItem("dashboard-widgets", JSON.stringify(Object.fromEntries(ids.map((id) => [id, false]))));
	});
	await page.reload();
	await expect(page.getByText("Every widget is hidden.")).toBeVisible();
	await page.getByRole("button", { name: "Choose widgets" }).click();
	await page.getByRole("button", { name: "Reset layout" }).click();
	await expect(page.locator("#dashboard-grid .widget")).toHaveCount(12);
});

test("edit mode sizes a widget, and remembers it until a reset", async ({ page }) => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	await mockDashboardFeeds(page);
	await page.goto("/dashboard");
	const hn = page.locator('#dashboard-grid [data-widget="hn"]');
	await expect(hn.locator(".hn-item").first()).toBeVisible();
	// Medium by default: wide enough for the vote scores.
	await expect(hn.locator(".hn-score").first()).toBeVisible();
	const before = await hn.boundingBox();

	await page.getByRole("button", { name: "Toggle layout edit mode" }).click();
	const picker = page.getByRole("group", { name: "Size of Hacker News" });
	await expect(picker.getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");
	await picker.getByRole("button", { name: "Small" }).click();
	await expect(picker.getByRole("button", { name: "Small" })).toHaveAttribute("aria-pressed", "true");
	// A picked size is kept as is: one column wide, not grown into a gap.
	const narrower = async () => (await hn.boundingBox()).width < before.width * 0.75;
	await expect.poll(narrower).toBe(true);

	await page.reload();
	await expect(hn.locator(".hn-item").first()).toBeVisible();
	expect(await narrower()).toBe(true);

	await page.getByRole("button", { name: "Toggle layout edit mode" }).click();
	await page.getByRole("button", { name: "Reset layout" }).click();
	await expect(picker.getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");
	await expect.poll(narrower).toBe(false);
});

test("auto-arrange fills the gaps picked sizes leave, and is remembered", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockDashboardFeeds(page);
	await page.addInitScript(() => {
		if (sessionStorage.getItem("seeded")) return;
		sessionStorage.setItem("seeded", "1");
		localStorage.setItem("dashboard-sizes", JSON.stringify({
			clock: "s", weather: "s", running: "l", cycling: "s", spotify: "s",
			forecast: "m", recovery: "s", week: "m", strava: "l", github: "m", gallery: "s", hn: "m",
		}));
	});
	await page.goto("/dashboard");
	await expect(page.locator(".github-repo")).toBeVisible();

	// Empty cells: the grid's area less what the tiles cover.
	const holes = () => page.evaluate(() => {
		const grid = document.querySelector("#dashboard-grid");
		const cols = Number(grid.dataset.cols);
		let covered = 0;
		let rows = 0;
		for (const slot of grid.querySelectorAll(".slot:not([hidden])")) {
			// Inline as "start / span n".
			const [, w] = slot.style.gridColumn.match(/span (\d+)/).map(Number);
			const [y, h] = slot.style.gridRow.match(/(\d+) \/ span (\d+)/).slice(1).map(Number);
			covered += w * h;
			rows = Math.max(rows, y - 1 + h);
		}
		return rows * cols - covered;
	});
	const before = await holes();
	expect(before).toBeGreaterThan(0);

	await page.getByRole("button", { name: "Toggle layout edit mode" }).click();
	await page.getByRole("button", { name: "Auto-arrange" }).click();
	await expect.poll(holes).toBeLessThan(before);
	const after = await holes();

	const order = () => page.evaluate(() => [...document.querySelectorAll("#dashboard-grid .slot:not([hidden]) .widget")]
		.map((el) => el.dataset.widget));
	const arranged = await order();
	await page.reload();
	await expect(page.locator(".github-repo")).toBeVisible();
	expect(await order()).toEqual(arranged);
	expect(await holes()).toBe(after);
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

// Each window size runs with every widget at its default size, then all
// picked Small, then all picked Large (World clocks has no Large; a size a
// widget doesn't offer is ignored).
const WIDGET_IDS = ["clock", "weather", "running", "cycling", "spotify", "forecast", "recovery", "week", "strava", "github", "gallery", "hn", "clocks"];
const SIZE_SETS = [
	["default sizes", null],
	["all small", "s"],
	["all large", "l"],
];

for (const [width, height] of SIZES) for (const [sizeName, sizeKey] of SIZE_SETS) {
	test(`widgets fit their tiles at ${width}×${height}, ${sizeName}`, async ({ page }) => {
		await page.setViewportSize({ width, height });
		await mockDashboardFeeds(page);
		if (sizeKey) {
			await page.addInitScript((sizes) => {
				localStorage.setItem("dashboard-sizes", JSON.stringify(sizes));
			}, Object.fromEntries(WIDGET_IDS.map((id) => [id, sizeKey])));
		}
		await page.goto("/dashboard");
		await expect(page.locator(".github-repo")).toBeVisible();
		await expect(page.locator(".hn-item").first()).toBeVisible();
		await expect(page.locator(".strava-row").first()).toBeVisible();
		await expect(page.locator(".weather-temp")).toHaveText("21°");
		await expect(page.locator('[data-widget="running"] .t-last .t-title')).toBeVisible();
		await expect(page.locator('[data-widget="forecast"] .hour').first()).toBeVisible();
		await expect(page.locator('[data-widget="week"] .wk-day').first()).toBeVisible();
		// List trimming runs a frame after a resize; give it a couple.
		await page.waitForTimeout(250);

		const report = await page.evaluate(() => {
			const overflows = [];
			// Content counts as cut off if it crosses the edge of the tile, or
			// of any box between it and the tile that clips (overflow other
			// than visible): text clipped by an inner container is as lost as
			// text spilling out of the tile.
			const clips = (el) => getComputedStyle(el).overflow !== "visible";
			for (const widget of document.querySelectorAll("#dashboard-grid .widget")) {
				for (const el of widget.querySelectorAll("*")) {
					// An SVG's children are drawn in its viewBox; the <svg> itself is checked.
					if (el.ownerSVGElement) continue;
					if (getComputedStyle(el).visibility === "hidden") continue;
					const r = el.getBoundingClientRect();
					if (r.width === 0 && r.height === 0) continue;
					for (let box = el.parentElement; box; box = box.parentElement) {
						if (box !== widget && !clips(box)) continue;
						const b = box.getBoundingClientRect();
						const over = Math.max(r.bottom - b.bottom, r.right - b.right, b.top - r.top, b.left - r.left);
						if (over > 1) {
							overflows.push(`${widget.dataset.widget}: .${[...el.classList].join(".") || el.tagName} by ${Math.round(over)}px`);
							break;
						}
						if (box === widget) break;
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
