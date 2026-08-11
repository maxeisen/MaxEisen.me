import { describe, it, expect } from "vitest";
import { toDayKey, addDays, daysBetween, mondayOf, eachDay } from "./dates.js";

describe("toDayKey", () => {
	it("takes the date portion of an ISO timestamp", () => {
		expect(toDayKey("2026-08-11T19:30:00Z")).toBe("2026-08-11");
	});

	it("accepts a Date", () => {
		expect(toDayKey(new Date("2026-08-11T00:00:00Z"))).toBe("2026-08-11");
	});

	it("rejects anything that isn't a date", () => {
		expect(toDayKey("not a date")).toBeNull();
		expect(toDayKey(null)).toBeNull();
		expect(toDayKey(new Date("nonsense"))).toBeNull();
	});
});

describe("addDays", () => {
	it("moves forward and backward", () => {
		expect(addDays("2026-08-11", 1)).toBe("2026-08-12");
		expect(addDays("2026-08-11", -1)).toBe("2026-08-10");
	});

	it("crosses month and year boundaries", () => {
		expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
	});

	it("handles a leap day", () => {
		expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
	});

	it("counts a whole day across a DST transition", () => {
		// North American DST springs forward on 2026-03-08. Local Date maths
		// would land back on the 8th here; UTC day counting must not.
		expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
		expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
	});
});

describe("daysBetween", () => {
	it("is positive forward and negative backward", () => {
		expect(daysBetween("2026-08-11", "2026-08-18")).toBe(7);
		expect(daysBetween("2026-08-18", "2026-08-11")).toBe(-7);
	});

	it("counts the full training block", () => {
		expect(daysBetween("2026-08-11", "2026-10-11")).toBe(61);
	});
});

describe("mondayOf", () => {
	it("returns the same day for a Monday", () => {
		expect(mondayOf("2026-08-10")).toBe("2026-08-10");
	});

	it("walks back from mid-week", () => {
		expect(mondayOf("2026-08-13")).toBe("2026-08-10");
	});

	it("keeps Sunday in the week it closes", () => {
		// Sunday long runs belong to the week just finished, not the next one.
		expect(mondayOf("2026-08-16")).toBe("2026-08-10");
	});
});

describe("eachDay", () => {
	it("is inclusive at both ends", () => {
		expect(eachDay("2026-08-10", "2026-08-13")).toEqual([
			"2026-08-10",
			"2026-08-11",
			"2026-08-12",
			"2026-08-13",
		]);
	});

	it("returns a single day for a zero-length range", () => {
		expect(eachDay("2026-08-10", "2026-08-10")).toEqual(["2026-08-10"]);
	});

	it("returns nothing for an inverted range", () => {
		expect(eachDay("2026-08-13", "2026-08-10")).toEqual([]);
	});
});
