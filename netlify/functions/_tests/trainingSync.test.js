// The scheduled Strava sync.
//
// This is the only writer of the /training history, it can't be invoked over
// HTTP, and it has to make progress in bounded batches without exhausting a
// rate limit shared with the /dashboard widgets — so the properties worth
// asserting are about convergence: every invocation stores something, no
// invocation loses track of what it didn't get to, and a repeated run finishes
// the job rather than picking the same newest activities forever.

import { describe, it, expect, vi, beforeEach } from "vitest";

const blobs = new Map();
const store = {
	get: vi.fn(async (key) => blobs.get(key) ?? null),
	setJSON: vi.fn(async (key, value) => {
		blobs.set(key, value);
	}),
};
vi.mock("@netlify/blobs", () => ({ getStore: () => store }));

import { SHAPE_VERSION } from "../_shared/training/shape.js";
import { addDays } from "../_shared/training/dates.js";

// A day per activity walking back from the most recent, so "newest first" is
// unambiguous in the assertions below.
function summaries(count, overrides = () => ({})) {
	return Array.from({ length: count }, (_, i) => {
		const day = new Date(Date.UTC(2026, 6, 1) + (count - i) * 86_400_000)
			.toISOString()
			.slice(0, 10);
		return {
			id: 1000 + i,
			name: `Run ${i}`,
			type: "Run",
			sport_type: "Run",
			private: false,
			start_date_local: `${day}T07:00:00Z`,
			distance: 10000,
			moving_time: 3000,
			...overrides(i),
		};
	});
}

function detailFor(summary) {
	return {
		...summary,
		elapsed_time: 3100,
		total_elevation_gain: 40,
		average_heartrate: 150,
		max_heartrate: 175,
		splits_metric: [{ distance: 1000, moving_time: 300, elevation_difference: 3 }],
		best_efforts: [{ name: "5k", distance: 5000, elapsed_time: 1450 }],
	};
}

// Stand in for Strava. `quota` is echoed back as rate-limit headers so the
// budget logic can be driven from a test.
function mockStrava({ activities = [], quota = null, failStreams = false } = {}) {
	const calls = [];
	globalThis.fetch = vi.fn(async (url) => {
		const target = String(url);
		calls.push(target);
		const headers = quota
			? { "x-ratelimit-limit": quota.limit, "x-ratelimit-usage": quota.usage }
			: {};
		const reply = (body, status = 200) =>
			new Response(JSON.stringify(body), { status, headers });

		if (target.includes("/oauth/token")) {
			return reply({ access_token: "tok", expires_at: Math.floor(Date.now() / 1000) + 3600 });
		}
		if (target.includes("/athlete/activities")) {
			const page = Number(new URL(target).searchParams.get("page"));
			return reply(page === 1 ? activities : []);
		}
		if (target.includes("/athlete/zones")) {
			return reply({ heart_rate: { zones: [{ min: 0, max: 130 }] } });
		}
		if (/\/activities\/\d+\/streams/.test(target)) {
			return failStreams ? reply({ message: "no streams" }, 404) : reply({});
		}
		const match = target.match(/\/activities\/(\d+)/);
		if (match) {
			const summary = activities.find((a) => String(a.id) === match[1]);
			return reply(detailFor(summary));
		}
		throw new Error(`unexpected fetch ${target}`);
	});
	return calls;
}

async function sync(query = "") {
	const { default: handler } = await import("../trainingSync.js");
	const res = await handler(
		new Request(`https://maxeisen.me/.netlify/functions/trainingSync${query}`),
	);
	return { res, body: await res.json() };
}

const index = () => blobs.get("index.json") || [];
const cursor = () => blobs.get("cursor.json") || {};

beforeEach(() => {
	vi.resetModules();
	blobs.clear();
	store.get.mockClear();
	store.setJSON.mockClear();
	process.env.STRAVA_CLIENT_ID = "id";
	process.env.STRAVA_CLIENT_SECRET = "secret";
	process.env.STRAVA_REFRESH_TOKEN = "refresh";
});

describe("trainingSync", () => {
	it("stores shaped runs on a cold start", async () => {
		mockStrava({ activities: summaries(3) });
		const { body } = await sync();

		expect(body.ok).toBe(true);
		expect(body.synced).toBe(3);
		expect(index()).toHaveLength(3);
		expect(index()[0].v).toBe(SHAPE_VERSION);
		// Oldest first, which is what the metrics engine expects.
		expect(index().map((a) => a.startDateLocal)).toEqual(
			[...index().map((a) => a.startDateLocal)].sort(),
		);
	});

	it("never enriches other people's business: private runs and rides are dropped", async () => {
		mockStrava({
			activities: [
				...summaries(1),
				{ ...summaries(1)[0], id: 5001, private: true },
				{ ...summaries(1)[0], id: 5002, sport_type: "Ride", type: "Ride" },
			],
		});
		const { body } = await sync();

		expect(body.runs).toBe(1);
		expect(index().map((a) => a.id)).toEqual([1000]);
	});

	// The budget is what keeps an invocation inside Netlify's 30s cap for
	// scheduled functions; the cursor is what stops the deferred remainder
	// being skipped past and never fetched again.
	it("defers what it can't finish and holds the cursor back until it has", async () => {
		mockStrava({ activities: summaries(40) });
		const first = await sync();

		expect(first.body.synced).toBe(30);
		expect(first.body.outstanding).toBe(10);
		expect(cursor().lastActivityEpoch).toBeNull();

		const second = await sync();
		expect(second.body.synced).toBe(10);
		expect(second.body.outstanding).toBe(0);
		expect(index()).toHaveLength(40);
		expect(cursor().lastActivityEpoch).toBeGreaterThan(0);
	});

	it("fills the most recent weeks first, so a partial page is a current one", async () => {
		mockStrava({ activities: summaries(40) });
		await sync();

		const newest = summaries(40)
			.map((a) => a.start_date_local)
			.sort()
			.slice(-30);
		expect(index().map((a) => a.startDateLocal)).toEqual(newest);
	});

	// A backfill shares its rate limit with the /dashboard widgets, which are
	// in a visitor's request path. Stopping short of the limit is the only
	// thing that keeps those working while this catches up.
	it("stops enriching once its share of the rate limit is spent", async () => {
		const calls = mockStrava({
			activities: summaries(30),
			quota: { limit: "100,1000", usage: "59,100" },
		});
		const { body } = await sync();

		expect(body.quotaPaused).toBe(true);
		expect(body.synced).toBeLessThan(30);
		expect(body.outstanding).toBeGreaterThan(0);
		expect(calls.filter((c) => /\/activities\/\d+\?/.test(c)).length).toBeLessThan(30);
	});

	it("publishes how much is left so the page can say it's still filling in", async () => {
		mockStrava({ activities: summaries(40) });
		await sync();

		expect(cursor()).toMatchObject({ outstanding: 10, stored: 30 });
		expect(cursor().lastRunAt).toEqual(expect.any(String));
	});

	// A completed run never changes, so re-listing the block must not re-fetch
	// what's already stored at the current shape version.
	it("does no upstream work when it is already caught up", async () => {
		mockStrava({ activities: summaries(3) });
		await sync();

		const calls = mockStrava({ activities: summaries(3) });
		const { body } = await sync();

		expect(body.synced).toBe(0);
		expect(calls.some((c) => /\/activities\/\d+\?/.test(c))).toBe(false);
		// Zones don't change on their own either, and every skipped call is
		// quota left for the widgets.
		expect(calls.some((c) => c.includes("/athlete/zones"))).toBe(false);
	});

	// Bumping SHAPE_VERSION is the only way stored records get corrected, since
	// the derived fields come from streams that aren't kept.
	it("re-enriches records left behind by an older shape version", async () => {
		mockStrava({ activities: summaries(2) });
		await sync();
		blobs.set(
			"index.json",
			index().map((a) => ({ ...a, v: SHAPE_VERSION - 1 })),
		);

		const { body } = await sync();
		expect(body.rescan).toBe(true);
		expect(body.synced).toBe(2);
		expect(index().every((a) => a.v === SHAPE_VERSION)).toBe(true);
	});

	it("stores a manual entry that has no streams rather than dropping it", async () => {
		mockStrava({ activities: summaries(1), failStreams: true });
		const { body } = await sync();

		expect(body.synced).toBe(1);
		expect(index()[0].zoneSeconds).toBeNull();
	});

	it("reports missing credentials instead of writing an empty history", async () => {
		delete process.env.STRAVA_REFRESH_TOKEN;
		mockStrava({ activities: summaries(1) });

		const { res, body } = await sync();
		expect(res.status).toBe(503);
		expect(body.error).toBe("not_configured");
		expect(store.setJSON).not.toHaveBeenCalled();
	});

	it("leaves the stored history alone when Strava can't be listed", async () => {
		mockStrava({ activities: summaries(2) });
		await sync();
		const before = index();

		globalThis.fetch = vi.fn(async (url) =>
			String(url).includes("/oauth/token")
				? new Response(
						JSON.stringify({ access_token: "tok", expires_at: Math.floor(Date.now() / 1000) + 3600 }),
						{ status: 200 },
					)
				: new Response("nope", { status: 500 }),
		);
		const { res, body } = await sync();

		expect(res.status).toBe(502);
		expect(body.error).toBe("strava_failed");
		expect(index()).toEqual(before);
	});

	describe("the Oura window", () => {
		// Oura's date range excludes its end. Asking through today therefore
		// returns every night except last night, and the failure is quiet:
		// the panel fills in, the chart draws, and the most recent night on
		// record is silently the one before. This is the boundary that got it
		// wrong in production, so it's asserted rather than commented.
		// The sync anchors its days to the athlete's timezone, not UTC, and
		// for a few hours each evening those are different dates — which is
		// exactly the window this bug lived in, so the test has to agree with
		// the code about what "today" is rather than assume UTC.
		const today = () =>
			new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
		const tomorrow = () => addDays(today(), 1);

		function mockOura({ nights = [] } = {}) {
			const asked = [];
			globalThis.fetch = vi.fn(async (url, init) => {
				const target = String(url);
				if (target.includes("cloud.ouraring.com") || target.includes("/oauth/token")) {
					// Oura's token endpoint posts a form; Strava's doesn't.
					if (init?.body instanceof URLSearchParams) {
						return new Response(
							JSON.stringify({
								access_token: "oura",
								refresh_token: "next",
								expires_in: 86400,
							}),
							{ status: 200 },
						);
					}
					return new Response(
						JSON.stringify({ access_token: "tok", expires_at: Math.floor(Date.now() / 1000) + 3600 }),
						{ status: 200 },
					);
				}
				if (target.includes("/v2/usercollection/")) {
					asked.push(new URL(target));
					const data = target.includes("/sleep") && !target.includes("daily_sleep")
						? nights
						: [];
					return new Response(JSON.stringify({ data, next_token: null }), { status: 200 });
				}
				if (target.includes("/athlete/activities")) {
					return new Response(JSON.stringify([]), { status: 200 });
				}
				if (target.includes("/athlete/zones")) {
					return new Response(JSON.stringify({ heart_rate: { zones: [] } }), { status: 200 });
				}
				throw new Error(`unexpected fetch ${target}`);
			});
			return asked;
		}

		beforeEach(() => {
			process.env.OURA_CLIENT_ID = "id";
			process.env.OURA_CLIENT_SECRET = "secret";
			process.env.OURA_REFRESH_TOKEN = "refresh";
		});

		it("asks for a day past today, because the end is exclusive", async () => {
			const asked = mockOura();
			await sync();

			expect(asked.length).toBeGreaterThan(0);
			for (const url of asked) {
				expect(url.searchParams.get("end_date")).toBe(tomorrow());
			}
		});

		it("stores last night rather than dropping it at the boundary", async () => {
			const asked = mockOura({
				nights: [
					{
						day: today(),
						type: "long_sleep",
						"total_sleep_duration": 20880,
						"lowest_heart_rate": 46,
						"average_hrv": 82,
					},
				],
			});
			await sync();

			expect(asked.length).toBeGreaterThan(0);
			expect(blobs.get("recovery.json")).toEqual([
				expect.objectContaining({ day: today(), sleepSec: 20880 }),
			]);
		});

		it("reports the ring being unconfigured as normal rather than broken", async () => {
			delete process.env.OURA_CLIENT_ID;
			mockOura();
			const { res, body } = await sync();

			expect(res.status).toBe(200);
			expect(body.recovery).toEqual({ configured: false });
		});
	});
});
