import { test, expect } from "@playwright/test";
import { buildTrainingFixture } from "./fixtures/trainingPayload.js";

// /training is the one page on the site built out of charts and dense tables,
// which makes it the one page that can quietly get wider than a phone. That
// matters more than it sounds: index.html sets `width=device-width,
// initial-scale=1`, and without the initial-scale mobile Safari's shrink-to-fit
// would zoom the WHOLE page out to fit the widest element on it — a single
// overflowing axis row rendering every other section at ~60% size. Either way
// the fix is the same: nothing on the page may exceed the viewport width.
//
// The suite runs against `vite preview` with no Netlify Functions, so the
// dashboard payload is stubbed from the real metrics engine (see
// fixtures/trainingPayload.js) — the page needs data before it draws the wide
// parts at all.

const PHONE = { width: 390, height: 844 };
const NARROW_PHONE = { width: 360, height: 800 };

test.beforeEach(async ({ page }) => {
	const payload = buildTrainingFixture();
	await page.route("**/.netlify/functions/trainingData*", (route) =>
		route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) }),
	);
});

test("training route renders its sections", async ({ page }) => {
	await page.goto("/training");
	await expect(page).toHaveTitle(/Road to Chicago/i);
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Weekly volume" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Runs this block" })).toBeVisible();
});

test("every card explains its own metrics on demand", async ({ page }) => {
	await page.goto("/training");
	const card = page.locator("section.card").filter({ hasText: "Load and risk" }).first();
	const button = card.getByRole("button", { name: /Load and risk/i });

	await expect(button).toHaveAttribute("aria-expanded", "false");
	await button.click();
	await expect(button).toHaveAttribute("aria-expanded", "true");
	// The definition, not just a panel: this is the whole point of the button.
	await expect(card.getByText("7-day load divided by 28-day load", { exact: false })).toBeVisible();

	await button.click();
	await expect(button).toHaveAttribute("aria-expanded", "false");
});

test("the run log says which runs were the plan", async ({ page }) => {
	await page.goto("/training");
	const log = page.locator("section.card").filter({ hasText: "Runs this block" }).first();
	// The fixture runs the real plan file, which has day-level sessions, so
	// both kinds have to appear: matched sessions and unplanned extras.
	await expect(log.locator(".tag.plan").first()).toBeVisible();
	await expect(log.locator(".tag.extra-tag").first()).toBeVisible();
});

test("the last run is reported with what it did to the training", async ({ page }) => {
	await page.goto("/training");
	const panel = page.locator("section.card").filter({ hasText: "Last run" }).first();

	// What it was: the run itself, linked out to Strava for the map the
	// payload deliberately doesn't carry.
	await expect(panel.getByRole("link").first()).toHaveAttribute(
		"href",
		/strava\.com\/activities\/\d+/,
	);

	// How it went: a pace per kilometre, on an axis labelled in paces.
	const paces = await panel.locator(".y-axis span").allTextContents();
	expect(paces.length).toBeGreaterThan(2);
	expect(paces.every((label) => /^\d+:\d{2}$/.test(label))).toBe(true);

	// What it changed: all three of fitness, fatigue and form, each with a
	// signed delta rather than just a value.
	const changes = panel.locator(".change");
	await expect(changes).toHaveCount(3);
	for (const label of ["Fitness", "Fatigue", "Form"]) {
		await expect(panel.getByText(label, { exact: true })).toBeVisible();
	}
	await expect(changes.first().locator("strong")).toHaveText(/^[+-]?\d/);
});

test("the week's long run is a day rather than a bar that fills up all week", async ({ page }) => {
	await page.goto("/training");
	// By its heading, not its text: "Load and risk" says "this week's ramp".
	const week = page
		.locator("section.card")
		.filter({ has: page.getByRole("heading", { name: "This week" }) });

	// One bar, and it's the volume one. The long run had a second, which every
	// easy run filled in on its way past — the same kilometres, counted twice.
	await expect(week.locator(".track")).toHaveCount(1);

	// The fixture stands on a Tuesday, so Sunday's long run is still ahead: it
	// reads as the day it falls on rather than as a number partly reached.
	const longRun = week.locator(".long-run");
	await expect(longRun).toHaveClass(/ahead/);
	await expect(longRun).toContainText("Long run");
	await expect(longRun).toContainText("Sun");
	await expect(longRun).toContainText("20 km");
});

test("the charts are labelled with the values they plot", async ({ page }) => {
	await page.goto("/training");
	const volume = page.locator("section.card").filter({ hasText: "Weekly volume" }).first();
	const labels = await volume.locator(".y-axis span").allTextContents();
	expect(labels.length).toBeGreaterThan(2);
	// A y-axis of nothing but zeroes would pass a "has labels" check.
	expect(labels.some((text) => Number(text) > 0)).toBe(true);
});

// Rearranging is /dashboard's, code and behaviour both (lib/ui/reorder for the
// drag, lib/ui/editMode for when it's allowed): drag a panel onto another to
// swap them, free on a wide screen, behind the Edit toggle once the layout
// collapses and a press-and-drag would otherwise be a scroll.
test.describe("rearranging the panels", () => {
	const panelAt = (page, idx) => page.locator(`[data-slot-index="${idx}"] .panel`);
	const editToggle = (page) => page.getByRole("button", { name: "Toggle layout edit mode" });

	// Both ends of a drag have to be on screen at once: a pointer can't travel
	// past the viewport, and the drop target is found by hit-testing whatever
	// is under it. Panels are tall — stacked on a phone, one is taller than the
	// screen — so centre the point halfway between the two slots and then aim
	// at the middle of whatever part of each is actually showing. Scrolling is
	// instant because the site scrolls smoothly, and a drag measured
	// mid-animation aims at where the panels used to be.
	async function dragPanel(page, fromIdx, toIdx) {
		await page.evaluate(([from, to]) => {
			const centre = (i) => {
				const box = document.querySelector(`[data-slot-index="${i}"]`).getBoundingClientRect();
				return box.top + box.height / 2 + window.scrollY;
			};
			const between = (centre(from) + centre(to)) / 2;
			window.scrollTo({ top: Math.max(0, between - window.innerHeight / 2), behavior: "instant" });
		}, [fromIdx, toIdx]);

		const { height } = page.viewportSize();
		const visibleMiddle = (box) => ({
			x: box.x + box.width / 2,
			y: (Math.max(box.y, 12) + Math.min(box.y + box.height, height - 12)) / 2,
		});

		const source = visibleMiddle(await panelAt(page, fromIdx).boundingBox());
		const target = visibleMiddle(await page.locator(`[data-slot-index="${toIdx}"]`).boundingBox());

		await page.mouse.move(source.x, source.y);
		await page.mouse.down();
		await page.mouse.move(target.x, target.y, { steps: 14 });
		await page.mouse.up();
	}

	test("a drag swaps the two panels and the layout is remembered", async ({ page }) => {
		await page.goto("/training");
		const dragged = await panelAt(page, 0).getAttribute("data-panel");
		// Slot 5 is the top of the narrow column: a swap across the page, and
		// the two panels most likely to be on screen together.
		const displaced = await panelAt(page, 5).getAttribute("data-panel");

		await dragPanel(page, 0, 5);

		await expect(panelAt(page, 5)).toHaveAttribute("data-panel", dragged);
		await expect(panelAt(page, 0)).toHaveAttribute("data-panel", displaced);

		await page.reload();
		await expect(panelAt(page, 5)).toHaveAttribute("data-panel", dragged);
	});

	// A press that doesn't travel is still a click, which is what keeps every
	// link and disclosure inside a draggable panel working.
	test("a press that goes nowhere still opens what it pressed", async ({ page }) => {
		await page.goto("/training");
		const card = page.locator("section.card").filter({ hasText: "Weekly volume" }).first();
		const info = card.getByRole("button", { name: /Weekly volume/i });

		await info.click();
		await expect(info).toHaveAttribute("aria-expanded", "true");
	});

	test("there's no toggle to find on a wide screen", async ({ page }) => {
		await page.goto("/training");
		await expect(editToggle(page)).toHaveCount(0);
	});

	test("on a phone the panels wait to be told", async ({ page }) => {
		await page.setViewportSize(PHONE);
		await page.goto("/training");
		const first = await panelAt(page, 0).getAttribute("data-panel");

		// Dragging is off, so the page still scrolls with a finger rather than
		// picking up whichever panel it landed on.
		const idle = await panelAt(page, 0).evaluate((el) => getComputedStyle(el).touchAction);
		expect(idle).toBe("auto");

		await dragPanel(page, 0, 1);
		await expect(panelAt(page, 0)).toHaveAttribute("data-panel", first);

		await editToggle(page).click();
		const editing = await panelAt(page, 0).evaluate((el) => getComputedStyle(el).touchAction);
		expect(editing).toBe("none");

		await dragPanel(page, 0, 1);
		await expect(panelAt(page, 1)).toHaveAttribute("data-panel", first);
	});

	test("taps inside a panel don't fire while editing", async ({ page }) => {
		await page.setViewportSize(PHONE);
		await page.goto("/training");
		const card = page.locator("section.card").filter({ hasText: "Weekly volume" }).first();
		const info = card.getByRole("button", { name: /Weekly volume/i });

		await editToggle(page).click();
		// force: panels jiggle while editing, so nothing inside one is ever
		// "stable" — which is exactly the state this is testing.
		await info.click({ force: true });
		await expect(info).toHaveAttribute("aria-expanded", "false");

		await editToggle(page).click();
		await info.click();
		await expect(info).toHaveAttribute("aria-expanded", "true");
	});
});

for (const viewport of [PHONE, NARROW_PHONE]) {
	test(`training page fits a ${viewport.width}px viewport`, async ({ page }) => {
		await page.setViewportSize(viewport);
		await page.goto("/training");
		await expect(page.getByRole("heading", { name: "Weekly volume" })).toBeVisible();

		const overflow = await page.evaluate(() => {
			const root = document.documentElement;
			const widest = [...document.querySelectorAll("main.training *")]
				.map((el) => ({
					el,
					right: el.getBoundingClientRect().right + window.scrollX,
				}))
				.filter(({ right }) => right > root.clientWidth + 1)
				// Name the culprit in the failure message rather than just
				// reporting a number that doesn't say where to look.
				.map(({ el, right }) => `${el.tagName.toLowerCase()}.${el.className} → ${Math.round(right)}px`);
			return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, widest };
		});

		expect(overflow.widest).toEqual([]);
		expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
	});
}
