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

test("the charts are labelled with the values they plot", async ({ page }) => {
	await page.goto("/training");
	const volume = page.locator("section.card").filter({ hasText: "Weekly volume" }).first();
	const labels = await volume.locator(".y-axis span").allTextContents();
	expect(labels.length).toBeGreaterThan(2);
	// A y-axis of nothing but zeroes would pass a "has labels" check.
	expect(labels.some((text) => Number(text) > 0)).toBe(true);
});

// Rearranging shares its machinery with /dashboard (lib/ui/reorder), but this
// page gates it behind the Rearrange button, so the interesting part is that
// the gate opens, a drop lands in the right slot, and the choice survives a
// reload.
test.describe("rearranging the panels", () => {
	const panelAt = (page, idx) => page.locator(`[data-slot-index="${idx}"] .panel`);

	async function dragPanel(page, fromIdx, toIdx) {
		const source = await panelAt(page, fromIdx).boundingBox();
		const target = await page.locator(`[data-slot-index="${toIdx}"]`).boundingBox();
		await page.mouse.move(source.x + source.width / 2, source.y + 24);
		await page.mouse.down();
		await page.mouse.move(target.x + target.width / 2, target.y + 24, { steps: 14 });
		await page.mouse.up();
	}

	test("panels stay put until you ask to rearrange them", async ({ page }) => {
		await page.goto("/training");
		await expect(panelAt(page, 0)).toHaveAttribute("data-panel", "volume");

		await dragPanel(page, 0, 4);
		await expect(panelAt(page, 0)).toHaveAttribute("data-panel", "volume");
	});

	test("a drag swaps the two panels and the layout is remembered", async ({ page }) => {
		await page.goto("/training");
		const displaced = await panelAt(page, 4).getAttribute("data-panel");

		await page.getByRole("button", { name: "Rearrange" }).click();
		await dragPanel(page, 0, 4);

		await expect(panelAt(page, 4)).toHaveAttribute("data-panel", "volume");
		await expect(panelAt(page, 0)).toHaveAttribute("data-panel", displaced);

		await page.reload();
		await expect(panelAt(page, 4)).toHaveAttribute("data-panel", "volume");

		// And there's a way back out of any arrangement.
		await page.getByRole("button", { name: "Rearrange" }).click();
		await page.getByRole("button", { name: "Reset" }).click();
		await expect(panelAt(page, 0)).toHaveAttribute("data-panel", "volume");
	});

	test("the arrow keys move a panel without a pointer", async ({ page }) => {
		await page.goto("/training");
		await page.getByRole("button", { name: "Rearrange" }).click();

		await page.locator('[data-slot-index="0"] .panel-handle').focus();
		await page.keyboard.press("ArrowRight");

		await expect(panelAt(page, 1)).toHaveAttribute("data-panel", "volume");
	});

	test("taps inside a panel don't fire while rearranging", async ({ page }) => {
		await page.goto("/training");
		const card = page.locator("section.card").filter({ hasText: "Weekly volume" }).first();
		const info = card.getByRole("button", { name: /Weekly volume/i });

		await page.getByRole("button", { name: "Rearrange" }).click();
		// force: panels jiggle while editing, so nothing inside one is ever
		// "stable" — which is exactly the state this is testing.
		await info.click({ force: true });
		await expect(info).toHaveAttribute("aria-expanded", "false");

		await page.getByRole("button", { name: "Done" }).click();
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
