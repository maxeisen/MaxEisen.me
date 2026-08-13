import { describe, it, expect } from "vitest";
import {
	ACWR_CEILING,
	ACWR_FLOOR,
	fitnessGain,
	fitnessSeries,
	rollingMean,
	acwr,
	weeklySummaries,
	rampRate,
	longRunShare,
} from "./fitness.js";
import { eachDay } from "./dates.js";

// A steady diet of `load` every day from `from` to `to`.
function steady(from, to, load) {
	return new Map(eachDay(from, to).map((d) => [d, load]));
}

describe("fitnessSeries", () => {
	it("emits one entry per day including rest days", () => {
		const series = fitnessSeries(new Map([["2026-08-11", 100]]), {
			from: "2026-08-10",
			to: "2026-08-16",
		});
		expect(series).toHaveLength(7);
		expect(series.map((d) => d.load)).toEqual([0, 100, 0, 0, 0, 0, 0]);
	});

	it("builds fitness toward the steady-state daily load", () => {
		const series = fitnessSeries(steady("2026-01-01", "2026-12-31", 50), {
			from: "2026-01-01",
			to: "2026-12-31",
		});
		// A year of identical days should converge on that day's load.
		expect(series.at(-1).ctl).toBeCloseTo(50, 1);
		expect(series.at(-1).atl).toBeCloseTo(50, 1);
	});

	it("moves fatigue faster than fitness", () => {
		const series = fitnessSeries(steady("2026-08-01", "2026-08-14", 80), {
			from: "2026-08-01",
			to: "2026-08-14",
		});
		// Two weeks in, the 7-day trace should be well ahead of the 42-day one.
		expect(series.at(-1).atl).toBeGreaterThan(series.at(-1).ctl);
	});

	it("sheds fatigue and turns form positive during a taper", () => {
		const loads = steady("2026-06-01", "2026-09-01", 70);
		for (const day of eachDay("2026-09-02", "2026-09-21")) loads.set(day, 15);
		const series = fitnessSeries(loads, { from: "2026-06-01", to: "2026-09-21" });
		const preTaper = series.find((d) => d.date === "2026-09-01");
		const raceDay = series.at(-1);
		expect(preTaper.tsb).toBeLessThan(raceDay.tsb);
		expect(raceDay.tsb).toBeGreaterThan(0);
	});

	it("reports fitness, fatigue and form as of the same moment", () => {
		// The one that got away: ctl and atl were reported after the day's
		// load and tsb from before it, so a record contradicted itself and
		// every reader that did the subtraction disagreed with every reader
		// that trusted the field. On the page that looked like the last run
		// costing 4.7 of form while the chart drew form rising by 3.
		const loads = steady("2026-06-01", "2026-08-12", 60);
		loads.set("2026-08-12", 200);
		const series = fitnessSeries(loads, { from: "2026-06-01", to: "2026-08-12" });

		for (const day of series) {
			expect(day.tsb).toBeCloseTo(day.ctl - day.atl, 10);
		}
	});

	it("counts the day's own session against its form", () => {
		const series = fitnessSeries(new Map([["2026-08-12", 200]]), {
			from: "2026-08-11",
			to: "2026-08-12",
		});
		expect(series[0].tsb).toBe(0);
		// A hard run leaves you less fresh on the day you do it, which is the
		// reading the "what it did" panel has always given.
		expect(series[1].tsb).toBeLessThan(0);
	});

	it("returns nothing for an inverted range", () => {
		expect(fitnessSeries(new Map(), { from: "2026-08-12", to: "2026-08-10" })).toEqual([]);
	});
});

describe("fitnessGain", () => {
	const series = eachDay("2026-06-01", "2026-08-12").map((date, i) => ({ date, ctl: 20 + i }));

	it("measures the climb across the window, not the whole series", () => {
		// One a day for 28 days, from a series that starts 72 days earlier.
		expect(fitnessGain(series, "2026-08-12")).toBe(28);
	});

	it("reports a decline as a decline", () => {
		const falling = series.map((point, i) => ({ ...point, ctl: 100 - i }));
		expect(fitnessGain(falling, "2026-08-12")).toBe(-28);
	});

	it("says nothing rather than measuring from a day that wasn't trained", () => {
		// A block whose history starts inside the window has no earlier CTL to
		// subtract, and treating the missing day as zero would report the
		// whole of someone's fitness as four weeks' worth of gain.
		const short = eachDay("2026-08-01", "2026-08-12").map((date) => ({ date, ctl: 50 }));
		expect(fitnessGain(short, "2026-08-12")).toBeNull();
		expect(fitnessGain([], "2026-08-12")).toBeNull();
		expect(fitnessGain(series, null)).toBeNull();
	});
});

describe("rollingMean", () => {
	it("averages over the window, counting rest days as zero", () => {
		const loads = new Map([
			["2026-08-10", 70],
			["2026-08-11", 70],
		]);
		expect(rollingMean(loads, "2026-08-16", 7)).toBeCloseTo(20, 6);
	});
});

describe("acwr", () => {
	it("sits at 1 when this week matches the last month", () => {
		const { ratio } = acwr(steady("2026-07-01", "2026-08-11", 60), "2026-08-11");
		expect(ratio).toBeCloseTo(1, 6);
	});

	it("rises above the ceiling when the last week spikes", () => {
		const loads = steady("2026-07-01", "2026-08-04", 30);
		for (const day of eachDay("2026-08-05", "2026-08-11")) loads.set(day, 120);
		const { ratio } = acwr(loads, "2026-08-11");
		expect(ratio).toBeGreaterThan(ACWR_CEILING);
	});

	it("falls below the floor during a lay-off", () => {
		const loads = steady("2026-07-01", "2026-08-04", 60);
		const { ratio } = acwr(loads, "2026-08-11");
		expect(ratio).toBeLessThan(ACWR_FLOOR);
	});

	it("returns null rather than dividing by an empty history", () => {
		expect(acwr(new Map(), "2026-08-11").ratio).toBeNull();
	});
});

describe("weeklySummaries", () => {
	const runs = [
		{ startDateLocal: "2026-08-10T07:00:00", distanceM: 10000, movingTimeSec: 3000, load: 55 },
		{ startDateLocal: "2026-08-16T07:00:00", distanceM: 30000, movingTimeSec: 9600, load: 180 },
		{ startDateLocal: "2026-08-17T07:00:00", distanceM: 8000, movingTimeSec: 2400, load: 40 },
	];

	it("anchors weeks on Monday and keeps Sunday in the closing week", () => {
		const weeks = weeklySummaries(runs);
		expect(weeks.map((w) => w.start)).toEqual(["2026-08-10", "2026-08-17"]);
		expect(weeks[0].runs).toBe(2); // Mon 10th + Sun 16th
		expect(weeks[0].distanceM).toBe(40000);
		expect(weeks[0].longestRunM).toBe(30000);
	});

	it("emits empty weeks across a range so a missed week is visible", () => {
		const weeks = weeklySummaries([], { from: "2026-08-10", to: "2026-08-30" });
		expect(weeks.map((w) => w.start)).toEqual(["2026-08-10", "2026-08-17", "2026-08-24"]);
		expect(weeks.every((w) => w.runs === 0)).toBe(true);
	});

	it("ignores activities without a usable date", () => {
		expect(weeklySummaries([{ distanceM: 5000 }])).toEqual([]);
	});
});

describe("rampRate", () => {
	it("reports growth and decline as a percentage", () => {
		expect(rampRate(55000, 50000)).toBeCloseTo(10, 6);
		expect(rampRate(45000, 50000)).toBeCloseTo(-10, 6);
	});

	it("returns null without a baseline week", () => {
		expect(rampRate(50000, 0)).toBeNull();
	});
});

describe("longRunShare", () => {
	it("reports the longest run as a percentage of the week", () => {
		expect(longRunShare({ distanceM: 60000, longestRunM: 18000 })).toBeCloseTo(30, 6);
	});

	it("returns null for a week with no running", () => {
		expect(longRunShare({ distanceM: 0, longestRunM: 0 })).toBeNull();
	});
});
