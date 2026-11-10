import { test, expect } from "@playwright/test";

// Smoke E2E: assert the highest-value routes BOOT and render their shell. They
// run against `vite preview` (the static production build) with no Netlify
// Functions, so they verify the SPA mounts and routes resolve — not live API
// data. Assertions stay structural (route renders, fetches settle) rather than
// content-exact, so they're stable in CI without secrets.
//
// Why no Bach E2E: a full round (create → join → write → vote → reveal) spans
// multiple concurrent clients and depends on external OpenAI text/image/TTS
// calls plus Netlify Blobs — slow, costly, and non-deterministic in CI. Its
// pure logic (validators, blob-key schema, story assembly, the readiness index,
// and the poll-cadence helper) is unit-tested instead (see netlify/functions/
// bach/_lib.test.js and src/components/Bach/lib/poll.test.js).

test("homepage boots and renders", async ({ page }) => {
	await page.goto("/");
	await expect(page).toHaveTitle("Max Eisen — Software Engineer");
	// The SPA mounted into #app rather than leaving a blank shell.
	await expect(page.locator("#app")).not.toBeEmpty();
});

// Links inside a homepage modal used to full-load the next page: the modal
// window stopped click propagation, so App.svelte's document listener (the
// thing that makes internal links client-side) never saw them.
for (const [activity, link, path] of [
	["running", /Running dashboard/, "/running"],
	["cycling", /Cycling dashboard/, "/cycling"],
]) {
	test(`the ${activity} modal's dashboard link navigates without reloading the site`, async ({ page }) => {
		await page.goto("/");
		await page.locator("activity", { hasText: activity }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();

		// A click inside the window must not close it…
		await dialog.locator("figcaption").click();
		await expect(dialog).toBeVisible();

		// …and the link must be a client-side navigation: state on window survives.
		await page.evaluate(() => { window.__noReload = true; });
		await dialog.getByRole("link", { name: link }).click();
		await expect(page).toHaveURL(new RegExp(`${path}$`));
		expect(await page.evaluate(() => window.__noReload)).toBe(true);
	});
}

test("clicking the backdrop closes a modal", async ({ page }) => {
	await page.goto("/");
	await page.locator("activity", { hasText: "skiing" }).click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await page.mouse.click(10, 10);
	await expect(dialog).toHaveCount(0);
});
