import { describe, it, expect } from "vitest";
import { mergeFeed, passesFeedFilter, shapeFeedItem } from "./stravaPublic.js";

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
		map: { summary_polyline: "_p~iF~ps|U_ulLnnqC" },
		...overrides,
	};
}

describe("passesFeedFilter", () => {
	it("keeps walks of 7km, runs of 5km, rides of 10km", () => {
		expect(passesFeedFilter(raw({ sport_type: "Walk", distance: 7000 }))).toBe(true);
		expect(passesFeedFilter(raw({ sport_type: "Hike", distance: 7000 }))).toBe(true);
		expect(passesFeedFilter(raw({ sport_type: "Run", distance: 5000 }))).toBe(true);
		expect(passesFeedFilter(raw({ sport_type: "Ride", distance: 10000 }))).toBe(true);
	});

	it("drops shorter activities and other sports", () => {
		expect(passesFeedFilter(raw({ sport_type: "Walk", distance: 6999 }))).toBe(false);
		expect(passesFeedFilter(raw({ sport_type: "Run", distance: 4999 }))).toBe(false);
		expect(passesFeedFilter(raw({ sport_type: "Ride", distance: 9999 }))).toBe(false);
		expect(passesFeedFilter(raw({ sport_type: "WeightTraining", moving_time: 3600 }))).toBe(false);
	});
});

describe("shapeFeedItem", () => {
	it("maps the public feed fields, including the polyline the widgets draw", () => {
		expect(shapeFeedItem(raw())).toEqual({
			id: 1,
			name: "Morning run",
			type: "Run",
			distance: 10000,
			movingTime: 3000,
			elapsedTime: 3100,
			elevationGain: 40,
			startDate: "2026-07-01T11:00:00Z",
			polyline: "_p~iF~ps|U_ulLnnqC",
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
			polyline: null,
			sufferScore: null,
		});
	});
});

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
});
