import { describe, it, expect } from "vitest";
import { stravaTag } from "./runTags.js";

describe("stravaTag", () => {
	it("names the workout type Strava recorded", () => {
		expect(stravaTag({ workoutType: 1 })).toBe("Race");
		expect(stravaTag({ workoutType: 2 })).toBe("Long run");
		expect(stravaTag({ workoutType: 3 })).toBe("Workout");
	});

	it("says nothing for an ordinary run", () => {
		expect(stravaTag({ workoutType: 0 })).toBeNull();
		expect(stravaTag({})).toBeNull();
		expect(stravaTag(null)).toBeNull();
	});

	it("stays quiet when the plan already said the same thing", () => {
		// Otherwise the row reads "long run · Long run".
		expect(stravaTag({ workoutType: 2, plan: { planned: true, type: "long run" } })).toBeNull();
	});

	it("still speaks up when it disagrees with the plan", () => {
		expect(stravaTag({ workoutType: 1, plan: { planned: true, type: "long run" } })).toBe("Race");
	});

	it("ignores a plan type on a run that wasn't matched to one", () => {
		expect(stravaTag({ workoutType: 2, plan: { planned: false, type: "long run" } })).toBe("Long run");
	});
});
