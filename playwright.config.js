import { defineConfig, devices } from "@playwright/test";

// E2E smoke config. Specs are named *.e2e.js (not *.test/spec.js) so Vitest's
// default globs never pick them up; Playwright matches them explicitly below.
//
// The suite runs against `vite preview` — the real production build, but with
// NO Netlify Functions — so smokes verify the SPA boots and routes render,
// not live API data (see e2e/*.e2e.js for the rationale).

const PORT = 6808;

export default defineConfig({
	testDir: "e2e",
	testMatch: "**/*.e2e.js",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: "list",
	timeout: 30_000,
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: "on-first-retry",
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
	],
	webServer: {
		// Build then serve the static bundle. reuseExistingServer lets a local
		// `npm run preview` already on :6808 be reused instead of rebuilding.
		command: "npm run build && npm run preview",
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
	},
});
