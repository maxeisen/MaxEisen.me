import { describe, it, expect } from "vitest";
import {
	efficiencyFactor,
	aerobicDecoupling,
	activityEfficiency,
	efficiencyTrend,
} from "./efficiency.js";

// A run of `count` samples, one second apart, at a fixed speed and HR.
function steady({ count, speedMps, hr, gradePct = 0, startTime = 0, startDistance = 0 }) {
	const time = [];
	const distance = [];
	const heartrate = [];
	const gradeSmooth = [];
	for (let i = 0; i <= count; i++) {
		time.push(startTime + i);
		distance.push(startDistance + i * speedMps);
		heartrate.push(hr);
		gradeSmooth.push(gradePct);
	}
	// Quoted because it's Strava's key, not one of ours.
	return { time, distance, heartrate, "grade_smooth": gradeSmooth };
}

// Two steady blocks back to back, for decoupling.
function twoHalves(a, b) {
	const first = steady(a);
	const second = steady({
		...b,
		startTime: first.time.at(-1),
		startDistance: first.distance.at(-1),
	});
	return {
		time: [...first.time, ...second.time.slice(1)],
		distance: [...first.distance, ...second.distance.slice(1)],
		heartrate: [...first.heartrate, ...second.heartrate.slice(1)],
		"grade_smooth": [...first.grade_smooth, ...second.grade_smooth.slice(1)],
	};
}

describe("efficiencyFactor", () => {
	it("is metres per minute per beat", () => {
		expect(efficiencyFactor(3, 150)).toBeCloseTo((3 * 60) / 150, 6);
	});

	it("rises with speed and falls with heart rate", () => {
		expect(efficiencyFactor(4, 150)).toBeGreaterThan(efficiencyFactor(3, 150));
		expect(efficiencyFactor(3, 170)).toBeLessThan(efficiencyFactor(3, 150));
	});

	it("returns null without both a speed and a pulse", () => {
		expect(efficiencyFactor(0, 150)).toBeNull();
		expect(efficiencyFactor(3, 0)).toBeNull();
		expect(efficiencyFactor(3, null)).toBeNull();
		expect(efficiencyFactor(null, 150)).toBeNull();
	});
});

describe("aerobicDecoupling", () => {
	it("reports no drift when pace and heart rate hold", () => {
		const out = aerobicDecoupling(steady({ count: 400, speedMps: 3, hr: 150 }));
		expect(out.decouplingPct).toBeCloseTo(0, 6);
	});

	it("reports positive decoupling when heart rate drifts up at the same pace", () => {
		const out = aerobicDecoupling(
			twoHalves({ count: 200, speedMps: 3, hr: 150 }, { count: 200, speedMps: 3, hr: 165 }),
		);
		expect(out.decouplingPct).toBeGreaterThan(0);
		expect(out.firstHalfEf).toBeGreaterThan(out.secondHalfEf);
	});

	it("reports positive decoupling when pace falls away at the same heart rate", () => {
		const out = aerobicDecoupling(
			twoHalves({ count: 200, speedMps: 3, hr: 150 }, { count: 200, speedMps: 2.7, hr: 150 }),
		);
		expect(out.decouplingPct).toBeGreaterThan(0);
	});

	it("goes negative on a negative split", () => {
		const out = aerobicDecoupling(
			twoHalves({ count: 200, speedMps: 2.8, hr: 150 }, { count: 200, speedMps: 3.1, hr: 150 }),
		);
		expect(out.decouplingPct).toBeLessThan(0);
	});

	// Otherwise a hilly second half reads as fatigue that never happened.
	it("does not blame gradient for decoupling", () => {
		const flat = aerobicDecoupling(
			twoHalves({ count: 200, speedMps: 3, hr: 150 }, { count: 200, speedMps: 3, hr: 150 }),
		);
		const uphill = aerobicDecoupling(
			twoHalves(
				{ count: 200, speedMps: 3, hr: 150 },
				// Slower, but uphill — the same effort in grade-adjusted terms.
				{ count: 200, speedMps: 2.2, hr: 150, gradePct: 5 },
			),
		);
		expect(uphill.decouplingPct).toBeLessThan(flat.decouplingPct + 5);
	});

	it("ignores a stop the watch didn't record through", () => {
		// The same run twice, once with ten minutes of standing dropped into
		// the middle of it. A pause writes no samples, so it arrives as one
		// sample covering six hundred seconds at walking-pace-on-GPS-drift —
		// left in, it drags the efficiency of whichever half holds it toward
		// zero and shifts the halfway line by a sixth of the run.
		const clean = steady({ count: 400, speedMps: 3, hr: 150 });
		const paused = steady({ count: 400, speedMps: 3, hr: 150 });
		for (let i = 200; i < paused.time.length; i++) paused.time[i] += 600;

		expect(aerobicDecoupling(paused).decouplingPct).toBeCloseTo(
			aerobicDecoupling(clean).decouplingPct,
			6,
		);
	});

	it("returns null for a run too short to halve", () => {
		expect(aerobicDecoupling(steady({ count: 5, speedMps: 3, hr: 150 }))).toBeNull();
	});

	it("returns null without heart rate", () => {
		const { heartrate, ...noHr } = steady({ count: 400, speedMps: 3, hr: 150 });
		expect(aerobicDecoupling(noHr)).toBeNull();
		expect(aerobicDecoupling(null)).toBeNull();
	});
});

describe("activityEfficiency", () => {
	it("derives speed from grade-adjusted pace", () => {
		// 300 s/km is 3.33 m/s.
		expect(activityEfficiency({ gapPaceSecPerKm: 300, averageHr: 150 })).toBeCloseTo(
			((1000 / 300) * 60) / 150,
			6,
		);
	});

	it("returns null without pace or heart rate", () => {
		expect(activityEfficiency({ averageHr: 150 })).toBeNull();
		expect(activityEfficiency({ gapPaceSecPerKm: 300 })).toBeNull();
		expect(activityEfficiency({})).toBeNull();
	});
});

describe("efficiencyTrend", () => {
	// Same HR, steadily faster: textbook aerobic improvement.
	const improving = Array.from({ length: 12 }, (_, i) => ({
		startDateLocal: `2026-06-${String(i + 1).padStart(2, "0")}T07:00:00`,
		averageHr: 150,
		gapPaceSecPerKm: 340 - i * 3,
	}));

	it("reports improvement as a positive change", () => {
		const out = efficiencyTrend(improving);
		expect(out.changePct).toBeGreaterThan(0);
		expect(out.latest).toBeGreaterThan(out.first);
	});

	it("reports decline as a negative change", () => {
		const declining = improving.map((a, i) => ({ ...a, gapPaceSecPerKm: 300 + i * 3 }));
		expect(efficiencyTrend(declining).changePct).toBeLessThan(0);
	});

	it("smooths the trend line relative to the raw points", () => {
		const noisy = improving.map((a, i) => ({
			...a,
			gapPaceSecPerKm: i % 2 === 0 ? 260 : 380,
		}));
		const out = efficiencyTrend(noisy);
		const spread = (xs) => Math.max(...xs) - Math.min(...xs);
		expect(spread(out.trend.map((p) => p.ef))).toBeLessThan(spread(out.points.map((p) => p.ef)));
	});

	// EF moves with intensity by construction, so leaving intervals in makes the
	// line track the week's schedule rather than fitness.
	it("excludes runs above the aerobic ceiling", () => {
		const withIntervals = [
			...improving,
			{ startDateLocal: "2026-06-13T07:00:00", averageHr: 180, gapPaceSecPerKm: 240 },
		];
		const out = efficiencyTrend(withIntervals, { aerobicCeilingHr: 165 });
		expect(out.points).toHaveLength(improving.length);
		expect(out.points.every((p) => p.date !== "2026-06-13")).toBe(true);
	});

	it("keeps every run when no ceiling is given", () => {
		expect(efficiencyTrend(improving).points).toHaveLength(12);
	});

	it("orders points by date regardless of input order", () => {
		const out = efficiencyTrend([...improving].reverse());
		const dates = out.points.map((p) => p.date);
		expect(dates).toEqual([...dates].sort());
	});

	it("withholds a verdict until there are enough runs to support one", () => {
		expect(efficiencyTrend(improving.slice(0, 4)).changePct).toBeNull();
	});

	it("survives runs with no heart rate or no pace", () => {
		const out = efficiencyTrend([
			{ startDateLocal: "2026-06-01T07:00:00", averageHr: null, gapPaceSecPerKm: 300 },
			{ startDateLocal: "2026-06-02T07:00:00", averageHr: 150, gapPaceSecPerKm: null },
			{ startDateLocal: "2026-06-03T07:00:00", averageHr: 150, gapPaceSecPerKm: 300 },
		]);
		expect(out.points).toHaveLength(1);
	});

	it("survives having nothing to trend", () => {
		const out = efficiencyTrend([]);
		expect(out.points).toEqual([]);
		expect(out.changePct).toBeNull();
	});
});
