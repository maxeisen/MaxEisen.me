import { describe, it, expect } from "vitest";
import { runCaptionWriter, runDetailLines } from "./runCaption.js";

const today = "2026-08-21"; // a Friday
// Zone 4 starts at 166 bpm with these, so 150 is aerobic and 170 isn't.
const thresholds = { maxHr: 191, restingHr: 47, lactateThresholdHr: 175 };

function run(id, day, extra = {}) {
	return {
		id,
		sport: "run",
		startDateLocal: `${day}T07:00:00`,
		distanceM: 10000,
		movingTimeSec: 3000,
		paceSecPerKm: 300,
		gapPaceSecPerKm: 300,
		averageHr: 150,
		load: 60,
		...extra,
	};
}

const earlier = [
	run(1, "2026-07-20", { gapPaceSecPerKm: 310 }),
	run(2, "2026-07-30", { gapPaceSecPerKm: 305 }),
	run(3, "2026-08-10", { gapPaceSecPerKm: 300 }),
	// Hard, and so no part of what an aerobic run's efficiency is against.
	run(4, "2026-08-18", { gapPaceSecPerKm: 250, averageHr: 172, distanceM: 8000, movingTimeSec: 2400 }),
];

const plan = {
	thresholds,
	weeks: [
		{
			start: "2026-08-17",
			sessions: [
				{ day: "Tuesday", type: "intervals", distanceKm: 8 },
				{ day: "Friday", type: "long run", distanceKm: 24, detail: "last 6 km at marathon pace" },
				{ day: "Sunday", type: "easy run", distanceKm: 10 },
			],
		},
	],
};

describe("runDetailLines", () => {
	it("writes pace with GAP, efficiency, decoupling, intensity, the week against plan and a longest-run flag", () => {
		const target = run(9, today, {
			distanceM: 24000,
			movingTimeSec: 7440,
			paceSecPerKm: 310,
			gapPaceSecPerKm: 296,
			decouplingPct: 3.24,
			zoneSeconds: [1200, 5000, 900, 300, 40],
		});
		const runs = [...earlier, target];
		const lines = runDetailLines(target, { runs, plan });

		expect(lines).toEqual([
			"Pace     5:10/km  ·  GAP 4:56/km",
			// 1.35 against a median of 1.31 over the three aerobic runs before.
			"Efficiency  1.35 m/min/bpm  ·  103% of typical",
			"Decoupling  3.2%  ·  under 5%",
			"Intensity  83% easy  ·  12% moderate  ·  5% hard",
			"Week     2 runs  ·  32 of 42 km  ·  2h 44m",
			"Longest run in 6 weeks",
		]);
	});

	it("gives a hard run no efficiency line, and a flat short one no GAP or decoupling", () => {
		const target = run(9, today, { averageHr: 170, decouplingPct: 8, movingTimeSec: 2700 });
		const lines = runDetailLines(target, { runs: [...earlier, target], plan });
		expect(lines[0]).toBe("Pace     5:00/km");
		expect(lines.some((l) => /Efficiency|Decoupling|GAP/.test(l))).toBe(false);
	});

	it("leaves the plan out of the week line when there's no plan", () => {
		const target = run(9, today);
		const lines = runDetailLines(target, { runs: [...earlier, target] });
		expect(lines).toContain("Week     2 runs  ·  18 km  ·  1h 30m");
	});
});

describe("runCaptionWriter", () => {
	it("finds the planned session for the run and puts the detail between load and projection", () => {
		const target = run(9, today, { distanceM: 24000, movingTimeSec: 7440, paceSecPerKm: 310 });
		const records = [...earlier, target, { id: 50, sport: "ride", startDateLocal: `${today}T12:00:00`, distanceM: 90000 }];
		const series = [
			{ date: "2026-08-20", ctl: 40, atl: 44, tsb: -4, load: 0 },
			{ date: "2026-08-21", ctl: 41, atl: 52, tsb: -11, load: 120 },
		];
		const lines = runCaptionWriter({ records, series, plan }).linesFor(target);

		// The sentence on what the run was, a blank line, then the figures.
		expect(lines[0]).toBe("Planned session: last 6 km at marathon pace (24 km).");
		expect(lines[1]).toBe("");
		expect(lines.slice(2, 6).map((l) => l.split(/\s/)[0])).toEqual(["Fitness", "Fatigue", "Form", "Load"]);
		// A ride the same week isn't a run.
		expect(lines).toContain("Week     2 runs  ·  32 of 42 km  ·  2h 44m");
	});
});

describe("runCaptionWriter titles", () => {
	const target = run(9, today, { distanceM: 24000, movingTimeSec: 7440, paceSecPerKm: 310, name: "Morning Run" });
	const writer = runCaptionWriter({ records: [...earlier, target], series: [], plan });

	it("names a run that still has Strava's default title after its planned session", () => {
		expect(writer.titleFor(target, { name: "Morning Run" })).toBe("Last 6 km at marathon pace");
	});

	it("leaves a title the athlete wrote alone", () => {
		expect(writer.titleFor(target, { name: "Long one with Sam" })).toBeNull();
	});
});
