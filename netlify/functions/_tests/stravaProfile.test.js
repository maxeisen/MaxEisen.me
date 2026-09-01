// Homepage intro modals: YTD totals plus the bike/shoes on the most recent
// ride and run. The old GET /athlete `primary` flag is not the per-sport
// default, so this asserts we walk activities and look up gear by id.

import { describe, it, expect, vi, beforeEach } from "vitest";

const TARMAC = {
	id: "b-tarmac",
	name: "Tarmax (on Hunts)",
	brand_name: "Specialized",
	model_name: "Tarmac SL7",
	distance: 9_000_000,
	primary: false,
};
const SUPERBLAST = {
	id: "g-superblast",
	name: "ASICS Superblast 3 🍜",
	brand_name: "ASICS",
	model_name: "Superblast 3",
	distance: 400_000,
	primary: false,
};
const CITY = { id: "b-city", name: "City Bike", distance: 600_000, primary: false };

function activities() {
	return [
		{ id: 1, sport_type: "Run", type: "Run", gear_id: SUPERBLAST.id },
		{ id: 2, sport_type: "Ride", type: "Ride", gear_id: TARMAC.id },
		{ id: 3, sport_type: "Ride", type: "Ride", gear_id: CITY.id },
	];
}

function stats() {
	return {
		ytd_run_totals: { count: 10, distance: 100_000, moving_time: 30_000, elevation_gain: 200 },
		ytd_ride_totals: { count: 8, distance: 200_000, moving_time: 20_000, elevation_gain: 400 },
	};
}

function mockStrava({ listing = activities(), gear = { [TARMAC.id]: TARMAC, [SUPERBLAST.id]: SUPERBLAST } } = {}) {
	const calls = [];
	globalThis.fetch = vi.fn(async (url) => {
		const target = String(url);
		calls.push(target);
		const reply = (body, status = 200) =>
			new Response(JSON.stringify(body), { status });

		if (target.includes("/oauth/token")) {
			return reply({ access_token: "tok", expires_at: Math.floor(Date.now() / 1000) + 3600 });
		}
		if (target.includes("/athlete/activities")) return reply(listing);
		if (target.includes("/athletes/") && target.includes("/stats")) return reply(stats());
		const gearMatch = target.match(/\/gear\/([^/?]+)/);
		if (gearMatch) {
			const item = gear[gearMatch[1]];
			return item ? reply(item) : reply({ message: "not found" }, 404);
		}
		if (target.endsWith("/athlete")) {
			throw new Error("GET /athlete should not be used for gear");
		}
		throw new Error(`unexpected fetch ${target}`);
	});
	return calls;
}

async function payload() {
	const { default: handler } = await import("../stravaProfile.js");
	const res = await handler();
	return { res, body: await res.json() };
}

beforeEach(() => {
	vi.resetModules();
	process.env.STRAVA_CLIENT_ID = "id";
	process.env.STRAVA_CLIENT_SECRET = "secret";
	process.env.STRAVA_REFRESH_TOKEN = "refresh";
});

describe("stravaProfile", () => {
	it("returns the bike and shoes from the most recent ride and run", async () => {
		const calls = mockStrava();
		const { res, body } = await payload();

		expect(res.status).toBe(200);
		expect(body.bike).toEqual({ id: TARMAC.id, name: "Specialized Tarmac SL7", distance: TARMAC.distance });
		expect(body.shoes).toEqual({
			id: SUPERBLAST.id,
			name: "ASICS Superblast 3",
			distance: SUPERBLAST.distance,
		});
		expect(body.ytd.run.count).toBe(10);
		expect(body.ytd.ride.count).toBe(8);
		expect(calls.some((u) => /\/gear\/b-tarmac/.test(u))).toBe(true);
		expect(calls.some((u) => /\/gear\/g-superblast/.test(u))).toBe(true);
		expect(calls.some((u) => u.endsWith("/athlete") && !u.includes("activities"))).toBe(false);
	});

	it("omits gear when nothing recent has it attached", async () => {
		mockStrava({ listing: [{ id: 1, sport_type: "Run", type: "Run" }] });
		const { body } = await payload();
		expect(body.bike).toBeNull();
		expect(body.shoes).toBeNull();
		expect(body.ytd.run.count).toBe(10);
	});
});
