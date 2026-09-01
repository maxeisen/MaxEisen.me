import { describe, it, expect } from "vitest";
import { mostRecentGearId, shapeGear } from "./stravaGear.js";

// Newest first — the order Strava's activity listing returns.
function act(overrides) {
	return { sport_type: "Run", type: "Run", ...overrides };
}

describe("mostRecentGearId", () => {
	it("returns the newest matching activity that has a gear_id", () => {
		const activities = [
			act({ sport_type: "Run", gear_id: "g-superblast" }),
			act({ sport_type: "Run", gear_id: "g-old" }),
			act({ sport_type: "Ride", gear_id: "b-tarmac" }),
			act({ sport_type: "Ride", gear_id: "b-city" }),
		];
		expect(mostRecentGearId(activities, "run")).toBe("g-superblast");
		expect(mostRecentGearId(activities, "ride")).toBe("b-tarmac");
	});

	it("skips a matching activity that has no gear attached", () => {
		const activities = [
			act({ sport_type: "Run", gear_id: null }),
			act({ sport_type: "Run", gear_id: "g-superblast" }),
			act({ sport_type: "Ride" }),
			act({ sport_type: "Ride", gear_id: "b-tarmac" }),
		];
		expect(mostRecentGearId(activities, "run")).toBe("g-superblast");
		expect(mostRecentGearId(activities, "ride")).toBe("b-tarmac");
	});

	it("treats sport variants as run/ride and ignores walks", () => {
		const activities = [
			act({ sport_type: "Walk", gear_id: "g-walk" }),
			act({ sport_type: "TrailRun", gear_id: "g-trail" }),
			act({ sport_type: "Hike", gear_id: "g-hike" }),
			act({ sport_type: "GravelRide", gear_id: "b-gravel" }),
		];
		expect(mostRecentGearId(activities, "run")).toBe("g-trail");
		expect(mostRecentGearId(activities, "ride")).toBe("b-gravel");
	});

	it("is null when nothing matches", () => {
		expect(mostRecentGearId([], "run")).toBeNull();
		expect(mostRecentGearId(null, "ride")).toBeNull();
		expect(mostRecentGearId([act({ sport_type: "Ride", gear_id: "b1" })], "run")).toBeNull();
	});
});

describe("shapeGear", () => {
	it("keeps id, name, and distance", () => {
		expect(
			shapeGear({ id: "b1", name: "Tarmac", distance: 1234, primary: false }),
		).toEqual({ id: "b1", name: "Tarmac", distance: 1234 });
	});

	it("is null for missing gear", () => {
		expect(shapeGear(null)).toBeNull();
		expect(shapeGear(undefined)).toBeNull();
	});
});
