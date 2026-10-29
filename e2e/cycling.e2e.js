import { test, expect } from "@playwright/test";
import { buildCyclingFixture } from "./fixtures/cyclingPayload.js";
import { buildTrainingFixture } from "./fixtures/trainingPayload.js";

test("cycling route renders the ride dashboard", async ({ page }) => {
	const payload = buildCyclingFixture();
	await page.route("**/.netlify/functions/cyclingData*", (route) =>
		route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) }),
	);

	await page.goto("/cycling");
	await expect(page).toHaveTitle("Cycling — Max Eisen");
	for (const name of [
		"Last ride",
		"Recommendations",
		"Weekly volume",
		"Fitness and fatigue",
		"Aerobic efficiency",
		"This week",
		"Load and risk",
		"Recovery",
		"Intensity mix",
		"Recent activity",
	]) {
		await expect(page.getByRole("heading", { name })).toBeVisible();
	}
	await expect(page.getByText("186")).toBeVisible();
	await expect(page.getByText("29.2 km/h").first()).toBeVisible();
	await expect(page.getByText("Projected finish")).toHaveCount(0);
	await expect(page.getByText(/plan target/i)).toHaveCount(0);
});

test("running still leads with the last run", async ({ page }) => {
	const payload = buildTrainingFixture({ today: "2026-10-13" });
	await page.route("**/.netlify/functions/trainingData*", (route) =>
		route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) }),
	);

	await page.goto("/running");
	await expect(page.getByRole("heading", { name: "Last run" })).toBeVisible();
});
