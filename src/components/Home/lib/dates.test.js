import { describe, it, expect } from "vitest";
import { monthsBetween, parseMonth, shortMonth, spanLabel } from "./dates.js";

const NOW = new Date(2026, 10, 9); // 9 Nov 2026

describe("homepage role dates", () => {
	it("reads a month and year, a bare year, and Present", () => {
		expect(parseMonth("February 2026")).toEqual({ year: 2026, month: 1 });
		expect(parseMonth("2017")).toEqual({ year: 2017, month: 0 });
		expect(parseMonth("Present", NOW)).toEqual({ year: 2026, month: 10 });
		expect(parseMonth("sometime")).toBeNull();
	});

	it("counts both ends of a role, the way a résumé does", () => {
		expect(monthsBetween("July 2025", "February 2026")).toBe(8);
		expect(monthsBetween("February 2026", "Present", NOW)).toBe(10);
		expect(monthsBetween("September 2022", "July 2024")).toBe(23);
		expect(monthsBetween("May 2020", "September 2020")).toBe(5);
	});

	it("says a span in years and months", () => {
		expect(spanLabel(1)).toBe("1 mo");
		expect(spanLabel(8)).toBe("8 mos");
		expect(spanLabel(12)).toBe("1 yr");
		expect(spanLabel(23)).toBe("1 yr 11 mos");
		expect(spanLabel(25)).toBe("2 yrs 1 mo");
	});

	it("shortens a month for the facts row", () => {
		expect(shortMonth("September 2022")).toBe("Sep 2022");
		expect(shortMonth("Present")).toBe("Present");
	});
});
