// The no-JS /training page is HTML built from the same payload the SPA fetches.
// These tests catch the failures that would make that page lie, execute markup,
// or leave JS visitors without the app: unescaped names, a missing noscript
// swap, or a shell whose module script got eaten.

import { describe, it, expect } from "vitest";
import { injectTrainingFallback, renderTrainingFallback } from "./fallback.js";

const SHELL = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head><title>Get to Know Max Eisen | MaxEisen.me</title></head>
<body>
    <div id="app"></div>
    <noscript>
        <div><h1>You don't have JavaScript enabled! Check out my <a href="/resume">resume</a> instead!</h1></div>
    </noscript>
    <script type="module" src="/src/main.js"></script>
</body>
</html>`;

function payload(overrides = {}) {
	return {
		summary: {
			race: {
				name: "Chicago Marathon",
				date: "2026-10-11",
				goalTimeSec: 13200,
				goalPaceSecPerKm: 313,
			},
			daysToRace: 48,
			totals: { distanceM: 420000, runs: 42 },
			latest: { ctl: 62.4, atl: 71.1, tsb: -8.7, ctlGain: 3.2 },
			prediction: {
				predictedSec: 13080,
				riegelSec: 12900,
				vdotSec: 13080,
				vdot: 51.2,
				deltaSec: -120,
				onTrack: true,
				basis: { distanceM: 5000, timeSec: 1380, date: "2026-08-01" },
			},
			acwr: { ratio: 1.12, acute: 80, chronic: 71 },
			intensity: { easyPct: 81, moderatePct: 12, hardPct: 7, easySec: 8100, moderateSec: 1200, hardSec: 700, totalSec: 10000 },
			riskWeek: { rampPct: 4, longRunSharePct: 28, isCurrentWeek: false },
			efficiency: { changePct: 2.1 },
			longRun: null,
		},
		today: {
			date: "2026-08-24",
			training: { ctl: 62.4, atl: 71.1, tsb: -8.7, ctlDelta: 0.2, atlDelta: -1.1, tsbDelta: 1.3 },
			readiness: null,
			session: { status: "ahead", planned: [{ type: "easy", detail: "8 km", distanceKm: 8, isRun: true }], actualKm: 0 },
			prediction: null,
		},
		lastRun: {
			name: "Morning Run",
			date: "2026-08-23",
			daysAgo: 1,
			distanceM: 10000,
			movingTimeSec: 3000,
			paceSecPerKm: 300,
			averageHr: 148,
			load: 72,
			effort: "easy",
			impact: { form: { ctlDelta: 0.3, atlDelta: 4.1, tsbDelta: -3.8 } },
		},
		recommendations: [
			{
				id: "easy-share",
				severity: "good",
				title: "Easy days are actually easy",
				detail: "81% of the last four weeks was easy running. That's the mix this block is built on.",
				metric: 81,
				threshold: 80,
				unit: "percent",
			},
		],
		week: {
			start: "2026-08-24",
			days: [
				{
					date: "2026-08-24",
					isToday: true,
					isPast: false,
					planned: [{ type: "easy", detail: "8 km", distanceKm: 8, isRun: true }],
					actualKm: 0,
				},
			],
			longRun: { date: "2026-08-30", targetKm: 22, actualKm: 0, status: "ahead" },
		},
		weeks: [{ start: "2026-08-17", actualKm: 72, targetKm: 75, runs: 5 }],
		upcoming: [{ start: "2026-08-31", targetKm: 80, longRunKm: 24 }],
		recovery: {
			sleep: { recent: 7.2 * 3600, baseline: 7.4 * 3600 },
			restingHr: { recent: 48, baseline: 47, delta: 1 },
			hrv: { recent: 62, deltaPct: -2 },
			latest: { day: "2026-08-23" },
		},
		runs: [
			{
				id: 1,
				name: "Morning Run",
				sport: "run",
				startDateLocal: "2026-08-23T07:00:00Z",
				distanceM: 10000,
				movingTimeSec: 3000,
				paceSecPerKm: 300,
				plan: { planned: true, type: "easy" },
			},
		],
		sync: { lastRunAt: "2026-08-24T12:00:00.000Z", hasSynced: true, outstanding: 0, backfilling: false },
		...overrides,
	};
}

describe("injectTrainingFallback", () => {
	it("swaps the resume noscript for the training page and leaves the SPA boot intact", () => {
		const out = injectTrainingFallback(SHELL, "<h1>Chicago Marathon</h1>");

		expect(out).toContain('<div id="app"></div>');
		expect(out).toContain('<script type="module" src="/src/main.js"></script>');
		expect(out).toContain("/styles/training-fallback.css");
		expect(out).toMatch(/<noscript>[\s\S]*Chicago Marathon[\s\S]*<\/noscript>/);
		expect(out).not.toContain("/resume");
	});

	it("still wraps the body when the shell has no noscript of its own", () => {
		const bare = "<html><head></head><body><div id=\"app\"></div></body></html>";
		const out = injectTrainingFallback(bare, "<p>Today</p>");
		expect(out).toMatch(/<noscript>[\s\S]*Today[\s\S]*<\/noscript>/);
		expect(out).toContain('<div id="app"></div>');
	});
});

describe("renderTrainingFallback", () => {
	it("prints the race, the advice, the last run and the log as readable HTML", () => {
		const html = renderTrainingFallback(payload());

		expect(html).toContain("Chicago Marathon");
		expect(html).toContain("Easy days are actually easy");
		expect(html).toContain("81% of the last four weeks was easy running");
		expect(html).toContain("Morning Run");
		expect(html).toContain("What to do about it");
		expect(html).toContain("Recent activity");
		expect(html).toContain("Today");
		expect(html).toContain("strava.com/athletes/92118908");
	});

	it("escapes names so a run titled with markup cannot inject tags", () => {
		const html = renderTrainingFallback(
			payload({
				summary: {
					...payload().summary,
					race: { ...payload().summary.race, name: "<img src=x onerror=alert(1)>" },
				},
				lastRun: { ...payload().lastRun, name: "<script>alert(1)</script>" },
				runs: [{ ...payload().runs[0], name: "<b>xss</b>" }],
				recommendations: [
					{
						id: "x",
						severity: "info",
						title: "<script>pwned</script>",
						detail: "Fine. <img src=x>",
						metric: 1,
						threshold: 1,
						unit: "none",
					},
				],
			}),
		);

		expect(html).not.toContain("<script>alert(1)</script>");
		expect(html).not.toContain("<script>pwned</script>");
		expect(html).not.toContain("<img src=x");
		expect(html).not.toContain("<b>xss</b>");
		expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
		expect(html).toContain("&lt;b&gt;xss&lt;/b&gt;");
	});

	it("says so when the history is still importing rather than looking finished", () => {
		const html = renderTrainingFallback(
			payload({
				sync: { lastRunAt: null, hasSynced: false, outstanding: 0, backfilling: false },
				runs: [],
			}),
		);
		expect(html).toContain("Waiting for the first sync");
	});

	it("does not print geographic leftovers that a payload might still be carrying", () => {
		const html = renderTrainingFallback(
			payload({
				runs: [
					{
						...payload().runs[0],
						map: { summary_polyline: "_p~iF~ps|U_ulLnnqC" },
						start_latlng: [43.6532, -79.3832],
						location_city: "should-not-appear-as-a-coordinate-dump",
					},
				],
			}),
		);
		expect(html).not.toContain("_p~iF~ps|U_ulLnnqC");
		expect(html).not.toContain("43.6532");
		expect(html).not.toContain("-79.3832");
		expect(html).not.toContain("should-not-appear-as-a-coordinate-dump");
	});
});
