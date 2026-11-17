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
const box = (page, id) => page.locator(`[data-widget="${id}"]`).boundingBox();

test("a dragged widget moves to another column, and stays there", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockDashboardFeeds(page);
	await page.goto("/dashboard");
	await expect(page.locator(".github-repo")).toBeVisible();

	const from = await box(page, "clock");
	const hn = await box(page, "hn");
	// Carry the clock to the bottom of Hacker News, in the last column.
	await page.mouse.move(from.x + 40, from.y + 40);
	await page.mouse.down();
	await page.mouse.move(hn.x + hn.width / 2, hn.y + hn.height - 10, { steps: 16 });
	const placeholder = page.locator(".drop-placeholder");
	await expect(placeholder).toBeVisible();
	await expect.poll(async () => Math.round((await placeholder.boundingBox()).x)).toBe(Math.round(hn.x));
	await page.mouse.up();
	await expect(placeholder).toHaveCount(0);

	// It's in Hacker News's column, under it.
	await expect.poll(async () => Math.round((await box(page, "clock")).x)).toBe(Math.round(hn.x));
	const dropped = await box(page, "clock");
	expect(dropped.y).toBeGreaterThan((await box(page, "hn")).y);

	// After a reload it's there from the first frame.
	await page.reload();
	await expect(page.locator(".github-repo")).toBeVisible();
	const reloaded = await box(page, "clock");
	expect(Math.abs(reloaded.x - dropped.x)).toBeLessThan(4);
	expect(Math.abs(reloaded.y - dropped.y)).toBeLessThan(4);
});

test("a widget dropped at the edge starts a new column", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockDashboardFeeds(page);
	await page.goto("/dashboard");
	await expect(page.locator(".github-repo")).toBeVisible();

	const grid = await page.locator("#dashboard-grid").boundingBox();
	const columnsNow = () => page.evaluate(() => new Set(
		[...document.querySelectorAll("#dashboard-grid .slot:not([hidden])")].map((el) => el.style.left),
	).size);
	expect(await columnsNow()).toBe(4);

	const from = await box(page, "github");
	await page.mouse.move(from.x + 40, from.y + 40);
	await page.mouse.down();
	await page.mouse.move(grid.x + grid.width - 4, from.y + 40, { steps: 16 });
	await page.mouse.up();

	await expect.poll(columnsNow).toBe(5);
	// Alone in its column (once it's glided there), so as tall as the window allows.
	await expect.poll(async () => (await box(page, "github")).height).toBeGreaterThan(grid.height - 4);
	expect((await box(page, "github")).x).toBeGreaterThan((await box(page, "hn")).x);
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

test("dragging the gap between columns resizes them, and is remembered", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockDashboardFeeds(page);
	await page.goto("/dashboard");
	await expect(page.locator(".github-repo")).toBeVisible();

	const clockBefore = await box(page, "clock");
	const runningBefore = await box(page, "running");
	const handle = page.getByRole("separator", { name: "Resize columns" }).first();
	const h = await handle.boundingBox();

	// Escape mid-drag puts it back.
	await page.mouse.move(h.x + h.width / 2, h.y + 100);
	await page.mouse.down();
	await page.mouse.move(h.x + h.width / 2 + 150, h.y + 100, { steps: 8 });
	await expect.poll(async () => (await box(page, "clock")).width).toBeGreaterThan(clockBefore.width + 100);
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await expect.poll(async () => Math.round((await box(page, "clock")).width)).toBe(Math.round(clockBefore.width));

	// A real drag: one column grows by what its neighbour gives up, live.
	await page.mouse.move(h.x + h.width / 2, h.y + 100);
	await page.mouse.down();
	await page.mouse.move(h.x + h.width / 2 + 150, h.y + 100, { steps: 8 });
	await page.mouse.up();
	const clock = await box(page, "clock");
	const running = await box(page, "running");
	expect(Math.abs(clock.width - clockBefore.width - 150)).toBeLessThan(3);
	expect(Math.abs(running.width - runningBefore.width + 150)).toBeLessThan(3);

	await page.reload();
	await expect(page.locator(".github-repo")).toBeVisible();
	expect(Math.abs((await box(page, "clock")).width - clock.width)).toBeLessThan(2);
});

test("dragging the gap between two widgets resizes them, down to a minimum", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockDashboardFeeds(page);
	await page.goto("/dashboard");
	await expect(page.locator(".github-repo")).toBeVisible();

	const hnBefore = await box(page, "hn");
	const handle = page.getByRole("separator", { name: "Resize Hacker News and Code" });
	const h = await handle.boundingBox();
	await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
	await page.mouse.down();
	await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 2000, { steps: 8 });
	await page.mouse.up();

	// Hacker News took everything Code could give, leaving Code at 64px.
	const code = await box(page, "github");
	expect(Math.round(code.height)).toBe(64);
	expect((await box(page, "hn")).height).toBeGreaterThan(hnBefore.height);
	await expect(page.locator(".hn-item:visible")).not.toHaveCount(0);

	// The keyboard works too.
	await handle.focus();
	await page.keyboard.press("ArrowUp");
	await expect.poll(async () => Math.round((await box(page, "github")).height)).toBe(80);
});

test("reset puts the default layout back", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await mockDashboardFeeds(page);
	await page.goto("/dashboard");
	await expect(page.locator(".github-repo")).toBeVisible();
	const before = await box(page, "clock");
	await page.getByRole("separator", { name: "Resize columns" }).first().focus();
	await page.keyboard.press("Shift+ArrowRight");
	await expect.poll(async () => (await box(page, "clock")).width).toBeGreaterThan(before.width + 32);

	await page.getByRole("button", { name: "Toggle layout edit mode" }).click();
	await page.getByRole("button", { name: "Reset layout" }).click();
	await page.getByRole("button", { name: "Toggle layout edit mode" }).click();
	await expect.poll(async () => Math.round((await box(page, "clock")).width)).toBe(Math.round(before.width));
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

// Each window size runs with the default layout and with some extreme
// ones, since people can drag widgets to any size down to 200×64 px:
// everything in one column (wide, short strips), six narrow columns (tall,
// thin tiles), and lopsided weights (a mix of the smallest and the biggest).
const WIDGET_IDS = ["clock", "weather", "running", "cycling", "spotify", "forecast", "recovery", "week", "strava", "github", "gallery", "hn", "clocks"];
const column = (ids, weights = []) => ({ w: 1, items: ids.map((id, i) => ({ id, h: weights[i] ?? 1 })) });
const LAYOUT_SETS = [
	["default layout", null],
	["one column", [column(WIDGET_IDS)]],
	["six columns", [0, 2, 4, 6, 8, 10].map((i) => column(WIDGET_IDS.slice(i, i === 10 ? 13 : i + 2)))],
	["lopsided", [
		{ ...column(WIDGET_IDS.slice(0, 6), [1, 5, 1, 5, 1, 5]), w: 1 },
		{ ...column(WIDGET_IDS.slice(6), [1, 6, 1, 6, 1, 6, 1]), w: 6 },
	]],
];

for (const [width, height] of SIZES) for (const [layoutName, columns] of LAYOUT_SETS) {
	test(`widgets fit their tiles at ${width}×${height}, ${layoutName}`, async ({ page }) => {
		await page.setViewportSize({ width, height });
		await mockDashboardFeeds(page);
		if (columns) {
			await page.addInitScript((saved) => {
				localStorage.setItem("dashboard-columns", JSON.stringify({ columns: saved }));
			}, columns);
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
