import { describe, it, expect } from "vitest";
import { weekRange, pace, clock, km, pct, shortDate, daysAgo, signed, speed, readout, splitLead, timeTaken } from "./format.js";

describe("readout", () => {
	it("binds symbols to both numbers and says words once", () => {
		expect(readout(12, 10, "percent")).toBe("12% vs 10%");
		expect(readout(1.62, 1.5, "ratio")).toBe("1.62× vs 1.50×");
		expect(readout(7, 3, "bpm")).toBe("7 vs 3 bpm");
		expect(readout(12, 21, "days")).toBe("12 vs 21 days");
		expect(readout(13800, 13200, "duration")).toBe("3h 50m vs 3h 40m");
	});

	it("keeps the decimal that shows a threshold was crossed", () => {
		// Rounded to whole numbers these print "5% vs 5%" and "35% vs 35%",
		// which read as rules that fired without anything having happened.
		expect(readout(5.4, 5, "percent")).toBe("5.4% vs 5%");
		expect(readout(35.42, 35, "percent")).toBe("35.4% vs 35%");
	});

	it("drops the decimal when there isn't one", () => {
		expect(readout(72, 80, "percent")).toBe("72% vs 80%");
	});

	it("reads a value on its own when nothing was crossed", () => {
		expect(readout(1.24, null, "ratio")).toBe("1.24×");
		expect(readout(48, null, "bpm")).toBe("48 bpm");
	});

	it("leaves form unitless, because it has no unit", () => {
		expect(readout(-27, -25)).toBe("-27 vs -25");
	});

	it("has nothing to show without a number", () => {
		expect(readout(null, 10, "percent")).toBeNull();
		expect(readout(undefined, undefined, "percent")).toBeNull();
	});
});

describe("splitLead", () => {
	it("keeps the opening sentence and folds the rest away", () => {
		const { lead, rest } = splitLead(
			"Form is -27, below -25. That's normal in a heavy block. Take two easy days.",
		);
		expect(lead).toBe("Form is -27, below -25.");
		expect(rest).toBe("That's normal in a heavy block. Take two easy days.");
	});

	it("offers nothing to expand for a single sentence", () => {
		expect(splitLead("Acute-to-chronic ratio is 1.24, inside the corridor.")).toEqual({
			lead: "Acute-to-chronic ratio is 1.24, inside the corridor.",
			rest: "",
		});
	});

	it("doesn't break a sentence at a decimal point", () => {
		// "1.42×" and "1.5" are the numbers these rules are built on, and a
		// naive split on "." cuts every one of them in half.
		const { lead, rest } = splitLead(
			"Your last 7 days carry 1.42× the load of your 28-day average. Above 1.5 is where injury rates climb.",
		);
		expect(lead).toBe("Your last 7 days carry 1.42× the load of your 28-day average.");
		expect(rest).toBe("Above 1.5 is where injury rates climb.");
	});

	it("splits before a sentence that opens with a figure", () => {
		const { lead, rest } = splitLead("You came in under plan. 42 km against 50 km.");
		expect(lead).toBe("You came in under plan.");
		expect(rest).toBe("42 km against 50 km.");
	});

	it("survives prose it can't split", () => {
		expect(splitLead("")).toEqual({ lead: "", rest: "" });
		expect(splitLead(null)).toEqual({ lead: "", rest: "" });
	});
});

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

	it("spells a headline duration so it can't be read as metres", () => {
		// "48m" beside "9.30 km" is forty-eight metres at a glance.
		expect(timeTaken(2880)).toBe("48min");
		expect(timeTaken(4500)).toBe("1h15m");
		// The "h" already says these are times, so the "m" is safe again.
		expect(timeTaken(13_200)).toBe("3h40m");
		expect(timeTaken(3900)).toBe("1h05m");
		// And the rounding rolls the hour instead of reaching sixty minutes.
		expect(timeTaken(3599)).toBe("1h00m");
		expect(timeTaken(null)).toBe("—");
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
