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
	await expect(page).toHaveTitle(/Max Eisen/i);
	// The SPA mounted into #app rather than leaving a blank shell.
	await expect(page.locator("#app")).not.toBeEmpty();
});
