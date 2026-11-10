import { describe, it, expect } from "vitest";
import {
	STRAVA_ATHLETE_ID,
	STRAVA_PROFILE_URL,
	ROUTE_GRID,
	decodePolyline,
	mergeFeed,
	passesFeedFilter,
	routeShape,
	shapeFeedItem,
} from "./stravaPublic.js";

const CANONICAL = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

function raw(overrides = {}) {
	return {
		id: 1,
		name: "Morning run",
		sport_type: "Run",
		type: "Run",
		distance: 10000,
		moving_time: 3000,
		elapsed_time: 3100,
		total_elevation_gain: 40,
		start_date: "2026-07-01T11:00:00Z",
		suffer_score: 61,
		map: { summary_polyline: CANONICAL },
		...overrides,
	};
}

describe("STRAVA_PROFILE_URL", () => {
	it("is built from the one athlete id", () => {
		expect(STRAVA_PROFILE_URL).toBe(`https://www.strava.com/athletes/${STRAVA_ATHLETE_ID}`);
	});
});

describe("passesFeedFilter", () => {
	it("keeps walks of 7km, runs of 5km, rides of 10km", () => {
		expect(passesFeedFilter(raw({ sport_type: "Walk", distance: 7000 }))).toBe(true);
		expect(passesFeedFilter(raw({ sport_type: "Hike", distance: 7000 }))).toBe(true);
		expect(passesFeedFilter(raw({ sport_type: "Run", distance: 5000 }))).toBe(true);
		expect(passesFeedFilter(raw({ sport_type: "Ride", distance: 10000 }))).toBe(true);
	});

	it("drops shorter activities, other sports, and anything marked private", () => {
		expect(passesFeedFilter(raw({ sport_type: "Walk", distance: 6999 }))).toBe(false);
		expect(passesFeedFilter(raw({ sport_type: "Run", distance: 4999 }))).toBe(false);
		expect(passesFeedFilter(raw({ sport_type: "Ride", distance: 9999 }))).toBe(false);
		expect(passesFeedFilter(raw({ sport_type: "WeightTraining", moving_time: 3600 }))).toBe(false);
		expect(passesFeedFilter(raw({ private: true, distance: 20000 }))).toBe(false);
	});

	it("only keeps activities everyone can see", () => {
		expect(passesFeedFilter(raw({ visibility: "everyone" }))).toBe(true);
		expect(passesFeedFilter(raw({ visibility: "followers_only" }))).toBe(false);
		expect(passesFeedFilter(raw({ visibility: "only_me" }))).toBe(false);
	});
});

describe("shapeFeedItem", () => {
	it("maps the public feed fields, with a route shape in place of the polyline", () => {
		expect(shapeFeedItem(raw())).toEqual({
			id: 1,
			name: "Morning run",
			type: "Run",
			distance: 10000,
			movingTime: 3000,
			elapsedTime: 3100,
			elevationGain: 40,
			startDate: "2026-07-01T11:00:00Z",
			route: [[1000, 760], [880, 408], [0, 0]],
			sufferScore: 61,
		});
	});

	it("falls back to type when sport_type is missing and nulls optional fields", () => {
		expect(
			shapeFeedItem(
				raw({
					sport_type: undefined,
					type: "TrailRun",
					suffer_score: undefined,
					map: {},
					elapsed_time: undefined,
					total_elevation_gain: undefined,
				}),
			),
		).toMatchObject({
			type: "TrailRun",
			route: null,
			sufferScore: null,
		});
	});
});

describe("decodePolyline", () => {
	it("returns [] for empty input", () => {
		expect(decodePolyline("")).toEqual([]);
		expect(decodePolyline(null)).toEqual([]);
	});

	it("decodes the canonical example", () => {
		const pts = decodePolyline(CANONICAL);
		expect(pts).toHaveLength(3);
		expect(pts[0][0]).toBeCloseTo(38.5, 4);
		expect(pts[0][1]).toBeCloseTo(-120.2, 4);
		expect(pts[2][0]).toBeCloseTo(43.252, 4);
		expect(pts[2][1]).toBeCloseTo(-126.453, 4);
	});
});

describe("routeShape", () => {
	it("is null without at least two points", () => {
		expect(routeShape("")).toBeNull();
		expect(routeShape(undefined)).toBeNull();
	});

	it("keeps the shape but none of the coordinates", () => {
		const route = routeShape(CANONICAL);
		const flat = route.flat();
		expect(flat.every((n) => Number.isInteger(n) && n >= 0 && n <= ROUTE_GRID)).toBe(true);
		expect(JSON.stringify(route)).not.toMatch(/38\.5|120\.2|43\.25|126\.45/);
	});

	it("thins long routes to the point budget and keeps both ends", () => {
		const points = Array.from({ length: 500 }, (_, i) => [43 + i * 1e-4, -79 - (i % 7) * 1e-4]);
		const encoded = encode(points);
		const route = routeShape(encoded, 40);
		expect(route.length).toBeLessThanOrEqual(41);
		expect(route[0]).toEqual(routeShape(encoded, 1000)[0]);
		expect(route.at(-1)).toEqual(routeShape(encoded, 1000).at(-1));
	});
});

// Minimal Google polyline encoder for fixtures.
function encode(points) {
	let out = "";
	let pLat = 0;
	let pLng = 0;
	const enc = (v) => {
		let n = v < 0 ? ~(v << 1) : v << 1;
		let s = "";
		while (n >= 0x20) {
			s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
			n >>= 5;
		}
		return s + String.fromCharCode(n + 63);
	};
	for (const [lat, lng] of points) {
		const la = Math.round(lat * 1e5);
		const ln = Math.round(lng * 1e5);
		out += enc(la - pLat) + enc(ln - pLng);
		pLat = la;
		pLng = ln;
	}
	return out;
}

describe("mergeFeed", () => {
	it("puts newer activities first and lets incoming win on the same id", () => {
		const existing = [
			shapeFeedItem(raw({ id: 1, name: "Old name", start_date: "2026-07-01T11:00:00Z" })),
			shapeFeedItem(raw({ id: 2, start_date: "2026-07-02T11:00:00Z" })),
		];
		const incoming = [
			shapeFeedItem(raw({ id: 1, name: "Edited", start_date: "2026-07-01T11:00:00Z" })),
			shapeFeedItem(raw({ id: 3, start_date: "2026-07-03T11:00:00Z" })),
		];
		const merged = mergeFeed(existing, incoming);
		expect(merged.map((a) => a.id)).toEqual([3, 2, 1]);
		expect(merged.find((a) => a.id === 1).name).toBe("Edited");
	});

	it("caps the rolling list so a backfill cannot grow without bound", () => {
		const existing = Array.from({ length: 80 }, (_, i) =>
			shapeFeedItem(raw({ id: i + 1, start_date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T11:00:00Z` })),
		);
		const incoming = Array.from({ length: 40 }, (_, i) =>
			shapeFeedItem(raw({ id: 100 + i, start_date: `2026-07-${String((i % 28) + 1).padStart(2, "0")}T11:00:00Z` })),
		);
		expect(mergeFeed(existing, incoming)).toHaveLength(100);
	});

	it("can drop ids so a later listing that marks a run private removes it", () => {
		const existing = [
			shapeFeedItem(raw({ id: 1 })),
			shapeFeedItem(raw({ id: 2, start_date: "2026-07-02T11:00:00Z" })),
		];
		const merged = mergeFeed(existing, [], 100, { dropIds: [1] });
		expect(merged.map((a) => a.id)).toEqual([2]);
	});
});
