import { test, expect } from "@playwright/test";
import { buildTrainingFixture } from "./fixtures/trainingPayload.js";
import {
	MIN_GAIN_PX,
	bestSplit,
	columnHeight,
	imbalanceAt,
} from "../src/components/Training/lib/balance.js";

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
	await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
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
	const log = page.locator("section.card").filter({ hasText: "Recent activity" }).first();
	// The fixture runs the real plan file, which has day-level sessions, so
	// both kinds have to appear: matched sessions and unplanned extras.
	await expect(log.locator(".tag.plan").first()).toBeVisible();
	await expect(log.locator(".tag.extra").first()).toBeVisible();
});

test("a ride is listed as context, in a cyclist's units", async ({ page }) => {
	await page.goto("/training");
	const log = page.locator("section.card").filter({ hasText: "Recent activity" }).first();
	const ride = log.locator(".row.ride").first();

	await expect(ride.locator(".tag.ride-tag")).toHaveText("ride");
	// km/h rather than the min/km every run in the list is reported in.
	await expect(ride).toContainText(/\d+\.\d km\/h/);
	await expect(ride).toContainText("avg speed");
});

test("recovery is reported beside the training, not inside it", async ({ page }) => {
	await page.goto("/training");
	const panel = page.locator("section.card").filter({ hasText: "Recovery" }).first();

	// An average night, in hours and minutes rather than a score out of 100.
	await expect(panel.getByText(/^\d+h \d+m$/).first()).toBeVisible();
	await expect(panel.getByText("average night, last 7")).toBeVisible();

	// The measures that carry the argument: an overnight resting rate and a
	// variability figure, each against the athlete's own baseline.
	const detail = panel.locator(".detail");
	await expect(detail.getByText("Resting HR")).toBeVisible();
	await expect(detail.getByText("HRV")).toBeVisible();
	await expect(panel.locator(".bar").first()).toBeVisible();
});

test("a run carries what the athlete wrote about it, and nothing else", async ({ page }) => {
	await page.goto("/training");
	const log = page.locator("section.card").filter({ hasText: "Recent activity" }).first();

	const note = log.locator(".row-note").first();
	await expect(note).toContainText("wedding in the evening");
	await expect(note).toContainText("why");
	// The untagged half of the same description. It was written for Strava's
	// audience rather than this one, and it must not be on a public page.
	await expect(page.getByText(/Out and back along the water/)).toHaveCount(0);
});

// The fixture's nights are generated to follow the day before them, so a page
// willing to blame a run for a night would have every opportunity here.
test("no panel blames a run for the night around it", async ({ page }) => {
	await page.goto("/training");
	await expect(page.getByText(/hard day costs/i)).toHaveCount(0);
	const panel = page.locator("section.card").filter({ hasText: "Last run" }).first();
	await expect(panel.getByText(/night|slept/i)).toHaveCount(0);
});

test("form is read against the body, not only against the training log", async ({ page }) => {
	// Form is derived from load alone, so a fixture that trains normally never
	// reaches the states worth printing. The classification itself is covered
	// in the engine's unit tests; this is about the sentence appearing.
	const payload = buildTrainingFixture();
	payload.recovery.response.strain = { state: "absorbing", tsb: -31, restingHrUp: false, hrvDown: false };
	await page.route("**/.netlify/functions/trainingData*", (route) =>
		route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) }),
	);

	await page.goto("/training");
	const panel = page.locator("section.card").filter({ hasText: "Recovery" }).first();
	await expect(panel.locator(".verdict")).toContainText("absorbing a heavy block");
	await expect(panel.locator(".verdict")).toContainText("-31");
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

	// How it went: a pace per kilometre, on an axis labelled in paces. The
	// left axis specifically — the right one is heart rate, in bpm.
	const paces = await panel.locator(".y-axis:not(.right) span").allTextContents();
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

test("neither column runs on far past the other", async ({ page }) => {
	// The columns are independent, so a heavy one simply ends further down the
	// page: with the two tallest panels both on the left it finished a
	// thousand pixels below the right. The split used to be hand-balanced and
	// went stale every time a panel was added; it's now measured at runtime
	// (src/components/Training/lib/balance.js).
	//
	// Asserted against the best split available rather than a ratio, because a
	// ratio measures the panels and not the balancing. Only ten panels go into
	// two columns and three of them are seven hundred pixels tall, so the
	// achievable splits are coarse — the best one here leaves the columns 11%
	// apart, and the next best leaves them 22% apart. A threshold between
	// those two numbers passes and fails on how long a panel's prose happens
	// to be this week.
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto("/training");

	const measure = () =>
		page.evaluate(() => {
			const columns = [...document.querySelectorAll("#training-grid .col:not(.col-full)")];
			const style = getComputedStyle(columns[0]);
			return {
				gap: Number.parseFloat(style.rowGap) || 0,
				split: columns[0].querySelectorAll("[data-panel]").length,
				// In layout order, which is what a split is an index into.
				heights: columns.flatMap((col) =>
					[...col.querySelectorAll("[data-panel]")].map(
						(panel) => panel.getBoundingClientRect().height,
					),
				),
			};
		});

	// Balancing runs a frame after the payload renders, so the first paint is
	// the unbalanced one by design.
	await expect
		.poll(async () => {
			const { gap, split, heights } = await measure();
			const ideal = bestSplit(heights, { gap });
			// Within the bar a move has to clear, since the layout stops as
			// soon as no remaining move clears it.
			return imbalanceAt(heights, split, gap) - imbalanceAt(heights, ideal, gap);
		})
		.toBeLessThanOrEqual(MIN_GAIN_PX);

	// And a floor under it all, in case a future panel makes every split a bad
	// one and the assertion above cheerfully certifies the least bad.
	const { gap, split, heights } = await measure();
	const left = columnHeight(heights.slice(0, split), gap);
	const right = columnHeight(heights.slice(split), gap);
	expect(Math.min(left, right) / Math.max(left, right)).toBeGreaterThan(0.8);
});

test("a recommendation leads with its evidence and folds the reasoning away", async ({ page }) => {
	await page.goto("/training");
	const card = page.locator("section.card").filter({ hasText: "What to do about it" }).first();
	const rule = card.locator(".rec").filter({ has: page.locator("details") }).first();

	// The measurement is on screen; the reasoning behind it is a click away.
	// Twelve of these unfolded was a panel people scrolled past.
	const detail = rule.locator("details");
	await expect(detail).not.toHaveAttribute("open", /.*/);
	await expect(rule.locator("p.rest")).toBeHidden();

	await detail.locator("summary").click();
	await expect(rule.locator("p.rest")).toBeVisible();
});

test("a measured recommendation says what kind of number it is", async ({ page }) => {
	await page.goto("/training");
	const card = page.locator("section.card").filter({ hasText: "What to do about it" }).first();
	const readouts = await card.locator(".rec-metric").allTextContents();
	expect(readouts.length).toBeGreaterThan(0);

	// Percentages, ratios, heart rates and times all landed here as bare
	// numbers, which left "1.17 vs 1.50" sitting above "72 vs 80".
	for (const text of readouts) {
		expect(text).toMatch(/%|×|bpm|days|h \d+m/);
	}
});

test("scrubbing a chart reads out the values under the cursor", async ({ page }) => {
	await page.goto("/training");
	const card = page.locator("section.card").filter({ hasText: "Fitness and fatigue" }).first();
	const plot = card.locator(".plot");

	await expect(card.locator(".tip")).toHaveCount(0);

	await plot.scrollIntoViewIfNeeded();
	const box = await plot.boundingBox();
	await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);

	// All three series at one instant, which is the point: form is the gap
	// between the other two and can't be read from any of them alone.
	const tip = card.locator(".tip");
	await expect(tip).toBeVisible();
	for (const label of ["Fitness", "Fatigue", "Form"]) {
		await expect(tip.getByText(label, { exact: true })).toBeVisible();
	}

	// And it lets go rather than following the pointer off the chart.
	await page.mouse.move(box.x + box.width / 2, box.y - 60);
	await expect(card.locator(".tip")).toHaveCount(0);
});

test("the footer dates the sync, not the visit", async ({ page }) => {
	await page.goto("/training");
	const stamp = page.locator(".foot .stamp");

	// The page-build time ticks forward on a refresh that changed nothing, and
	// dates a payload the CDN may have been holding for ten minutes, so it
	// answers a question nobody asked.
	await expect(stamp).toHaveText(/^Last synced /);

	const shown = await stamp.textContent();
	const syncedAt = await page.evaluate(async () => {
		const res = await fetch("/.netlify/functions/trainingData");
		return (await res.json()).sync.lastRunAt;
	});
	const expected = new Date(syncedAt).toLocaleString("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	});
	expect(shown).toBe(`Last synced ${expected}`);
});

test("the last run scrubs to a point along it, not a kilometre of it", async ({ page }) => {
	await page.goto("/training");
	const card = page.locator("section.card").filter({ hasText: "Last run" }).first();
	const plot = card.locator(".plot");

	await plot.scrollIntoViewIfNeeded();
	const box = await plot.boundingBox();
	await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);

	const tip = card.locator(".tip");
	await expect(tip).toBeVisible();
	// A distance with metres in it. The panel used to read a kilometre at a
	// time, which is a resolution that averages an interval session flat: the
	// reps and the recoveries between them happen inside one split.
	await expect(tip.locator(".tip-label")).toHaveText(/^\d+\.\d\d km$/);
	await expect(tip.getByText("Pace", { exact: true })).toBeVisible();
	await expect(tip).toContainText(/\d+:\d\d\/km/);
	await expect(tip).toContainText(/\d+ bpm/);
});

test("the last run is drawn at a finer grain than its splits", async ({ page }) => {
	await page.goto("/training");
	const card = page.locator("section.card").filter({ hasText: "Last run" }).first();

	const { points, km } = await page.evaluate(async () => {
		const { lastRun } = await (await fetch("/.netlify/functions/trainingData")).json();
		return { points: lastRun.trace.m.length, km: lastRun.distanceM / 1000 };
	});
	// Several readings to the kilometre, which is the whole point of carrying
	// a trace at all rather than plotting the splits that were already there.
	expect(points / km).toBeGreaterThan(3);

	// And they're offered to the keyboard one at a time, so the fine grain is
	// reachable without a pointer.
	await card.locator(".plot").focus();
	await card.page().keyboard.press("ArrowRight");
	await expect(card.locator(".tip")).toBeVisible();
});

test("the last run plots heart rate on its own scale", async ({ page }) => {
	await page.goto("/training");
	const card = page.locator("section.card").filter({ hasText: "Last run" }).first();

	// Two units on one plot only works if the second one is labelled. Without
	// the right-hand axis the beats are a shape with no magnitude, and the
	// height it shares with the pace line is a coincidence of scaling.
	const beats = card.locator(".y-axis.right span");
	const labels = (await beats.allTextContents()).map(Number);
	expect(labels.length).toBeGreaterThan(2);
	for (const bpm of labels) {
		expect(bpm).toBeGreaterThan(60);
		expect(bpm).toBeLessThan(230);
	}
	// And it runs the other way up from the pace axis beside it. Pace is
	// flipped so faster is higher; heart rate isn't, because more beats is
	// more effort. Compare where they actually sit, since the two scales
	// agreeing on direction is exactly the mistake this would be.
	const placed = await beats.evaluateAll((nodes) =>
		nodes.map((node) => ({
			bpm: Number(node.textContent),
			bottom: node.getBoundingClientRect().bottom,
		})),
	);
	const highest = placed.reduce((a, b) => (a.bpm > b.bpm ? a : b));
	const lowest = placed.reduce((a, b) => (a.bpm < b.bpm ? a : b));
	expect(highest.bottom).toBeLessThan(lowest.bottom);
});

test("the chart cursor can be driven from the keyboard", async ({ page }) => {
	await page.goto("/training");
	const card = page.locator("section.card").filter({ hasText: "Weekly volume" }).first();
	const plot = card.locator(".plot");

	await plot.focus();
	// Focus lands on the most recent week: every chart here runs into today.
	const tip = card.locator(".tip");
	await expect(tip).toBeVisible();
	const last = await tip.locator(".tip-label").textContent();

	await page.keyboard.press("ArrowLeft");
	await expect(tip.locator(".tip-label")).not.toHaveText(last);

	await page.keyboard.press("Home");
	const first = await tip.locator(".tip-label").textContent();
	// Home is the far end of the series, not one step further left.
	await page.keyboard.press("ArrowLeft");
	await expect(tip.locator(".tip-label")).toHaveText(first);

	await page.keyboard.press("Escape");
	await expect(card.locator(".tip")).toHaveCount(0);
});

test("a chart readout at the edge of a phone doesn't widen the page", async ({ page }) => {
	// The readout is absolutely positioned over the plot, so at the last week
	// of a chart on a 360px screen it is exactly the sort of thing that hangs
	// off the right-hand side and takes the viewport with it.
	await page.setViewportSize(NARROW_PHONE);
	await page.goto("/training");

	const plot = page.locator("section.card").filter({ hasText: "Weekly volume" }).first().locator(".plot");
	await plot.scrollIntoViewIfNeeded();
	const box = await plot.boundingBox();
	await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
	await expect(page.locator(".tip").first()).toBeVisible();

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
	);
	expect(overflow).toBeLessThanOrEqual(0);
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
