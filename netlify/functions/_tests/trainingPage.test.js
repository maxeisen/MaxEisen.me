// /training is rewritten to this function so a no-JS browser gets the dashboard
// as HTML inside the SPA shell's noscript. JS visitors still boot the app from
// the same document. Fail-open: a payload error must not take the SPA with it.

import { describe, it, expect } from "vitest";
import { serveTrainingPage } from "../trainingPage.js";

const SHELL = `<!DOCTYPE html>
<html><head><title>site</title></head>
<body>
<div id="app"></div>
<noscript><a href="/resume">resume</a></noscript>
<script type="module" src="/src/main.js"></script>
</body></html>`;

const payload = {
	summary: {
		race: { name: "Chicago Marathon", date: "2026-10-11", goalTimeSec: 13200, goalPaceSecPerKm: 313 },
		daysToRace: 48,
		totals: { distanceM: 10000, runs: 1 },
		latest: null,
		prediction: null,
		acwr: null,
		intensity: null,
		riskWeek: null,
		efficiency: null,
	},
	today: { date: "2026-08-24", training: null, session: { status: "rest", planned: [], actualKm: 0 } },
	lastRun: null,
	recommendations: [],
	week: null,
	weeks: [],
	upcoming: [],
	recovery: null,
	runs: [],
	sync: { lastRunAt: "2026-08-24T12:00:00.000Z", hasSynced: true, outstanding: 0, backfilling: false },
};

describe("serveTrainingPage", () => {
	it("serves the SPA shell with a noscript dashboard built from the payload", async () => {
		const res = await serveTrainingPage({
			loadShell: async () => SHELL,
			loadPayload: async () => payload,
		});

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		expect(res.headers.get("Netlify-CDN-Cache-Control")).toBe("public, max-age=60");

		const html = await res.text();
		expect(html).toContain('<div id="app"></div>');
		expect(html).toContain('<script type="module" src="/src/main.js"></script>');
		expect(html).toContain("Chicago Marathon");
		expect(html).toContain("training-fallback.css");
		expect(html).not.toContain("/resume");
	});

	it("still returns the SPA shell when the payload cannot be built", async () => {
		const res = await serveTrainingPage({
			loadShell: async () => SHELL,
			loadPayload: async () => {
				throw new Error("blobs down");
			},
		});

		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('<div id="app"></div>');
		expect(html).toContain('<script type="module" src="/src/main.js"></script>');
		expect(html).toContain("/resume");
		expect(html).not.toContain("Chicago Marathon");
	});

	it("returns 503 when the SPA shell itself cannot be loaded", async () => {
		const res = await serveTrainingPage({
			loadShell: async () => {
				throw new Error("no index.html");
			},
			loadPayload: async () => payload,
		});
		expect(res.status).toBe(503);
	});
});
