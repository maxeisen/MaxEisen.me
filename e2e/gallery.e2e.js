import { test, expect } from "@playwright/test";

test("gallery route renders its shell and the photo fetch settles", async ({ page }) => {
	await page.goto("/gallery");
	await expect(page).toHaveTitle(/Gallery/i);

	// The page header renders independently of data.
	await expect(page.getByRole("heading", { name: "Gallery", level: 1 })).toBeVisible();

	// The grid starts on a "Loading photos…" placeholder. Assert it resolves —
	// to thumbnails when a backend is present (`netlify dev` + Cloudinary creds),
	// or to an empty/error placeholder under static preview — so we catch a
	// route that's wedged on the loader, without depending on live data.
	// Anchor to the start so the error state ("Network error loading photos.")
	// doesn't also match the loader text.
	await expect(page.getByText(/^Loading photos/i)).toBeHidden({ timeout: 15_000 });
});
