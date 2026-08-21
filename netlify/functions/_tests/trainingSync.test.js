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
// `listing` overrides what /athlete/activities returns without changing what
// the detail endpoint will serve, which is how a re-shape looks from here: the
// runs are all stored, nothing is new, and the listing has nothing to say.
function mockStrava({ activities = [], listing = null, quota = null, failStreams = false } = {}) {
	const calls = [];
	const puts = [];
	globalThis.fetch = vi.fn(async (url, init = {}) => {
		const target = String(url);
		const method = String(init.method || "GET").toUpperCase();
		calls.push(method === "GET" ? target : `${method} ${target}`);
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
			return reply(page === 1 ? (listing ?? activities) : []);
		}
		if (target.includes("/athlete/zones")) {
			return reply({ heart_rate: { zones: [{ min: 0, max: 130 }] } });
		}
		if (/\/activities\/\d+\/streams/.test(target)) {
			return failStreams ? reply({ message: "no streams" }, 404) : reply({});
		}
		const match = target.match(/\/activities\/(\d+)/);
		if (match) {
			if (method === "PUT") {
				puts.push({ id: match[1], body: init.body });
				return reply({ id: Number(match[1]), description: "ok" });
			}
			const summary = activities.find((a) => String(a.id) === match[1]);
			return reply(detailFor(summary));
		}
		throw new Error(`unexpected fetch ${target}`);
	});
	calls.puts = puts;
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
		expect(first.body.missing).toBe(10);
		expect(cursor().lastActivityEpoch).toBeNull();

		const second = await sync();
		expect(second.body.synced).toBe(10);
		expect(second.body.missing).toBe(0);
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
		expect(body.missing).toBeGreaterThan(0);
		expect(calls.filter((c) => /\/activities\/\d+\?/.test(c)).length).toBeLessThan(30);
	});

	it("publishes how much is left so the page can say it's still filling in", async () => {
		mockStrava({ activities: summaries(40) });
		await sync();

		expect(cursor()).toMatchObject({ missing: 10, stored: 30 });
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
	//
	// The listing here has nothing to offer — every run is already stored and
	// none are new — so a re-shape that waited to be told what to fetch would
	// do nothing at all. The stale records are queued from the index.
	it("re-enriches records left behind by an older shape version", async () => {
		mockStrava({ activities: summaries(2) });
		await sync();
		blobs.set(
			"index.json",
			index().map((a) => ({ ...a, v: SHAPE_VERSION - 1 })),
		);

		mockStrava({ activities: summaries(2), listing: [] });
		const { body } = await sync();
		expect(body.synced).toBe(2);
		expect(body.missing).toBe(0);
		expect(body.stale).toBe(0);
		expect(index().every((a) => a.v === SHAPE_VERSION)).toBe(true);
	});

	// The bug that made a version bump take days instead of an hour. Paging
	// back through the block costs three reads, and at a five-minute cadence
	// that's 864 a day against a limit of a thousand — so the sync spent its
	// entire quota being told ids it had on disk, and had nothing left to
	// fetch them with. One run trickled in every five minutes.
	it("re-shapes without paging back through the block", async () => {
		mockStrava({ activities: summaries(2) });
		await sync();
		const caughtUp = cursor().lastActivityEpoch;
		expect(caughtUp).toBeGreaterThan(0);
		blobs.set(
			"index.json",
			index().map((a) => ({ ...a, v: SHAPE_VERSION - 1 })),
		);

		const calls = mockStrava({ activities: summaries(2), listing: [] });
		const { body } = await sync();

		expect(body.rescan).toBe(false);
		const listings = calls.filter((c) => c.includes("/athlete/activities"));
		expect(listings).toHaveLength(1);
		expect(Number(new URL(listings[0]).searchParams.get("after"))).toBe(caughtUp);
	});

	// The distinction the page hangs on. A re-shape that can't finish leaves a
	// complete history whose numbers are slightly old — which is nothing like
	// a history with runs absent from it, and only the second is worth telling
	// a reader about. See syncState in trainingData.
	it("counts a run it can't re-shape as stale, never as missing", async () => {
		mockStrava({ activities: summaries(2) });
		await sync();
		blobs.set(
			"index.json",
			index().map((a) => ({ ...a, v: SHAPE_VERSION - 1 })),
		);

		mockStrava({
			activities: summaries(2),
			listing: [],
			quota: { limit: "100,1000", usage: "99,999" },
		});
		const { body } = await sync();

		expect(body.quotaPaused).toBe(true);
		expect(body.synced).toBe(0);
		expect(body.missing).toBe(0);
		expect(body.stale).toBe(2);
		expect(cursor()).toMatchObject({ missing: 0, stale: 2 });
	});

	it("still pages the whole block back when asked outright", async () => {
		mockStrava({ activities: summaries(2) });
		await sync();

		const calls = mockStrava({ activities: summaries(2) });
		const { body } = await sync("?full=1");

		expect(body.rescan).toBe(true);
		expect(body.synced).toBe(2);
		const listing = calls.find((c) => c.includes("/athlete/activities"));
		expect(Number(new URL(listing).searchParams.get("after"))).toBeLessThan(cursor().lastActivityEpoch);
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

	// A note is written after the run it explains, so the sweep is the only
	// thing that ever picks one up — and how long it waits between passes is
	// the whole delay on seeing it. The property worth asserting is that the
	// wait is short exactly when a note is likely (just after a run landed)
	// and long the rest of the time, since the calls come out of the same
	// quota the /dashboard widgets are drawing on.
	describe("the note sweep", () => {
		// The sweep only reads the last few days, and the sync's days are the
		// athlete's rather than UTC.
		const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

		function justRun(description) {
			return [
				{
					id: 9001,
					name: "Long run",
					type: "Run",
					sport_type: "Run",
					private: false,
					start_date_local: `${today()}T07:00:00Z`,
					distance: 22000,
					moving_time: 6600,
					...(description === undefined ? {} : { description }),
				},
			];
		}

		const notes = () => index()[0].notes;

		it("picks up a note written minutes after the run, not an hour after it", async () => {
			mockStrava({ activities: justRun() });
			await sync();
			expect(notes()).toEqual([]);

			// The sweep the run's arrival opened. Under an hourly cadence this
			// one would land too, since nothing has been swept yet.
			mockStrava({ activities: justRun("excuse: knee, cut it to 10k") });
			const first = await sync();
			expect(first.body.notesFresh).toBe(true);
			expect(first.body.notesRefreshed).toBe(1);
			expect(notes()).toEqual([{ kind: "excuse", text: "knee, cut it to 10k" }]);

			// This is the one the hourly cadence would have made the athlete
			// wait for: an edit five minutes later, on the same run.
			mockStrava({ activities: justRun("note: new shoes") });
			const second = await sync();
			expect(second.body.notesRefreshed).toBe(1);
			expect(notes()).toEqual([{ kind: "note", text: "new shoes" }]);
		});

		// Five minutes is worth its calls while the run is the thing being
		// looked at. A day later it's spending a quota shared with the
		// dashboard on a description nobody is editing.
		it("drops back to hourly once the run is a few hours old", async () => {
			mockStrava({ activities: justRun() });
			await sync();

			const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();
			blobs.set("cursor.json", {
				...cursor(),
				activityArrivedAt: hoursAgo(4),
				notesScannedAt: hoursAgo(0.25),
			});

			mockStrava({ activities: justRun("note: written much later") });
			const soon = await sync();
			expect(soon.body.notesFresh).toBe(false);
			expect(soon.body.notesRefreshed).toBe(0);
			expect(notes()).toEqual([]);

			blobs.set("cursor.json", { ...cursor(), notesScannedAt: hoursAgo(2) });
			const later = await sync();
			expect(later.body.notesRefreshed).toBe(1);
			expect(notes()).toEqual([{ kind: "note", text: "written much later" }]);
		});

		// The window is opened by a run the sweep would actually read. A cold
		// start stores four months of run-up history in one go, and none of
		// it is a run somebody is about to write a note on.
		it("isn't opened by a backfill of history nobody is looking at", async () => {
			mockStrava({ activities: summaries(3) });
			const { body } = await sync();

			expect(body.synced).toBe(3);
			expect(body.notesFresh).toBe(false);
			expect(cursor().activityArrivedAt).toBeNull();
		});

		// Notes are the cheapest thing here and the least urgent. A run with
		// no numbers on it at all is worth more than a description.
		it("waits for the backfill before spending anything on descriptions", async () => {
			const calls = mockStrava({ activities: [...justRun("note: hello"), ...summaries(40)] });
			const { body } = await sync();

			expect(body.missing).toBeGreaterThan(0);
			expect(body.notesRefreshed).toBe(0);
			// Every detail call this made was an enrichment, which carries its
			// query string; a note refresh asks for the activity bare.
			expect(calls.filter((c) => /\/activities\/\d+$/.test(c))).toHaveLength(0);
		});
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

	describe("captions", () => {
		const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

		function justRun() {
			return [
				{
					id: 9001,
					name: "Easy run",
					type: "Run",
					sport_type: "Run",
					private: false,
					start_date_local: `${today()}T07:00:00Z`,
					distance: 8000,
					moving_time: 2800,
				},
			];
		}

		it("writes a fenced block onto a new run once the index has it", async () => {
			mockStrava({ activities: justRun() });
			const first = await sync();
			expect(first.body.captioned).toBe(0);

			const calls = mockStrava({ activities: justRun() });
			const second = await sync();
			expect(second.body.captioned).toBe(1);
			expect(calls.puts).toHaveLength(1);
			const written = JSON.parse(calls.puts[0].body).description;
			expect(written).toContain("Generated by https://maxeisen.me/training");
			expect(written).not.toContain("── training");
			expect(index()[0].captionedAt).toEqual(expect.any(String));
		});
	});
});
