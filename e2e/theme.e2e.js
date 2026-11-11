import { test, expect } from "@playwright/test";

const theme = (page) => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
const saved = (page) => page.evaluate(() => localStorage.getItem("theme-choice"));

// iOS renders a backgrounded home-screen app in both light and dark for the
// app switcher, which reaches the page as prefers-color-scheme flipping while
// it's hidden. That used to be followed and saved, so the next launch could
// open in the wrong scheme.
test("scheme flips while the page is hidden aren't followed or saved", async ({ page }) => {
	await page.emulateMedia({ colorScheme: "dark" });
	await page.goto("/resume");
	const setHidden = (hidden) => page.evaluate((h) => {
		Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
		document.dispatchEvent(new Event("visibilitychange"));
	}, hidden);

	await setHidden(true);
	await page.emulateMedia({ colorScheme: "light" });
	await page.waitForTimeout(100);
	expect(await theme(page)).toBe("dark");
	await page.emulateMedia({ colorScheme: "dark" });
	await setHidden(false);
	expect(await theme(page)).toBe("dark");
	expect(await saved(page)).toBeNull();
});

test("coming back to the page catches up with the system", async ({ page }) => {
	await page.emulateMedia({ colorScheme: "dark" });
	await page.goto("/resume");
	await page.evaluate(() => Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }));
	await page.emulateMedia({ colorScheme: "light" });
	await page.evaluate(() => {
		Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
		document.dispatchEvent(new Event("visibilitychange"));
	});
	expect(await theme(page)).toBe("light");
});

test("a stale value under the old key is ignored", async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("theme", "light"));
	await page.emulateMedia({ colorScheme: "dark" });
	await page.goto("/resume");
	expect(await theme(page)).toBe("dark");
});

test("the toggle's choice is kept across loads and system changes", async ({ page }) => {
	await page.emulateMedia({ colorScheme: "dark" });
	await page.goto("/resume");
	await page.evaluate(() => window.toggleTheme());
	await expect.poll(() => theme(page)).toBe("light");
	expect(await saved(page)).toBe("light");

	await page.reload();
	expect(await theme(page)).toBe("light");
	await page.emulateMedia({ colorScheme: "light" });
	await page.emulateMedia({ colorScheme: "dark" });
	await page.waitForTimeout(100);
	expect(await theme(page)).toBe("light");

	// Toggling back to the system's scheme goes back to following it.
	await page.evaluate(() => window.toggleTheme());
	await expect.poll(() => theme(page)).toBe("dark");
	expect(await saved(page)).toBeNull();
});
