import { describe, it, expect } from "vitest";
import { weekRange, pace, clock, km, pct, shortDate, daysAgo, signed, speed } from "./format.js";

describe("speed", () => {
	it("reads a ride in km/h", () => {
		expect(speed(30000, 3600)).toBe("30.0 km/h");
		expect(speed(45500, 5400)).toBe("30.3 km/h");
	});

	it("has nothing to say without both halves of it", () => {
		expect(speed(30000, 0)).toBe("—");
		expect(speed(0, 3600)).toBe("—");
		expect(speed(null, null)).toBe("—");
	});
});

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

describe("daysAgo", () => {
	it("says today and yesterday rather than counting them", () => {
		expect(daysAgo(0)).toBe("Today");
		expect(daysAgo(1)).toBe("Yesterday");
	});

	it("counts days inside the week and weeks beyond it", () => {
		expect(daysAgo(3)).toBe("3 days ago");
		expect(daysAgo(7)).toBe("Last week");
		expect(daysAgo(18)).toBe("3 weeks ago");
	});

	it("has nothing to say about a day it can't place", () => {
		expect(daysAgo(null)).toBe("");
		expect(daysAgo(-2)).toBe("");
	});
});

describe("signed", () => {
	it("keeps the sign on both directions", () => {
		expect(signed(0.34)).toBe("+0.3");
		expect(signed(-1.25)).toBe("-1.3");
	});

	// A change of -0.04 is not a decrease worth drawing a minus sign for.
	it("never prints a negative zero", () => {
		expect(signed(-0.04)).toBe("0.0");
		expect(signed(0)).toBe("0.0");
	});

	it("takes the precision it's given", () => {
		expect(signed(12.4, 0)).toBe("+12");
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
		expect(km()).toBe("—");
		expect(pct(null)).toBe("—");
		expect(shortDate("")).toBe("");
	});
});
