import { describe, it, expect } from "vitest";
import { weekRange, pace, clock, km, pct, shortDate } from "./format.js";

describe("weekRange", () => {
	it("covers the seven days from the Monday", () => {
		expect(weekRange("2026-08-17")).toBe("17–23 Aug");
	});

	it("names both months when the week straddles them", () => {
		expect(weekRange("2026-08-31")).toBe("31 Aug – 6 Sept");
	});

	it("handles a week that crosses the year", () => {
		expect(weekRange("2026-12-28")).toBe("28 Dec – 3 Jan");
	});

	it("has nothing to say about a missing or unparseable week", () => {
		expect(weekRange(null)).toBe("");
		expect(weekRange("not-a-date")).toBe("");
	});
});

// The rest of the module predates this file; these are the cases the training
// display leans on most.
describe("training formatters", () => {
	it("rolls the minute rather than printing a sixtieth second", () => {
		expect(pace(359.7)).toBe("6:00/km");
	});

	it("prints a race time with hours only when there are any", () => {
		expect(clock(13200)).toBe("3:40:00");
		expect(clock(1800)).toBe("30:00");
	});

	it("drops noise decimals on big distances", () => {
		expect(km(12345)).toBe("12.3 km");
		expect(km(123456)).toBe("123 km");
	});

	it("reports missing values as an em dash rather than NaN", () => {
		expect(pace(null)).toBe("—");
		expect(km(undefined)).toBe("—");
		expect(pct(null)).toBe("—");
		expect(shortDate("")).toBe("");
	});
});
