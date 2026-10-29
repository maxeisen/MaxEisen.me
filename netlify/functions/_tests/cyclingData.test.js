import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";

const store = { get: vi.fn(), setJSON: vi.fn() };
vi.mock("@netlify/blobs", () => ({ getStore: () => store }));

const HANDLERS = ["cyclingData.js", "cyclingActivity.js", "cyclingPage.js"];

describe("cycling handlers stay off Strava", () => {
	it("does not import the Strava client", () => {
		for (const file of HANDLERS) {
			const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
			expect(text).not.toContain("strava.js");
			expect(text).not.toContain("STRAVA_API_BASE");
		}
	});
});

describe("loadCyclingDashboard", () => {
	beforeEach(() => {
		vi.resetModules();
		store.get.mockReset();
	});

	it("reads the newest ride and the sync cursor from blobs", async () => {
		store.get.mockImplementation(async (key) => {
			if (key === "index.json") {
				return [{
					id: 42,
					sport: "ride",
					name: "Evening",
					startDateLocal: "2026-10-20T08:00:00",
					distanceM: 40000,
					movingTimeSec: 5000,
					load: 50,
					averageHr: 140,
				}];
			}
			if (key === "cursor.json") return { lastRunAt: "2026-10-28T12:00:00.000Z" };
			return null;
		});
		const { loadCyclingDashboard } = await import("../_shared/training/dashboard.js");
		const payload = await loadCyclingDashboard("2026-10-28");
		expect(payload.lastRide.id).toBe(42);
		expect(payload.sync.hasSynced).toBe(true);
	});
});
