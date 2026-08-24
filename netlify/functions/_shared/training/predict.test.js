import { describe, it, expect } from "vitest";
import {
	riegel,
	vdot,
	timeForVdot,
	vdotProjection,
	predictFromEffort,
	predictRace,
	aerobicPotential,
	goalDelta,
	goalPaceSecPerKm,
} from "./predict.js";

const MARATHON_M = 42195;
const GOAL_SEC = 13200; // 3:40:00

describe("riegel", () => {
	it("returns the same time for the same distance", () => {
		expect(riegel(1200, 5000, 5000)).toBeCloseTo(1200, 6);
	});

	it("projects a 10k from a 5k a little slower than double", () => {
		const predicted = riegel(1200, 5000, 10000);
		expect(predicted).toBeGreaterThan(2400);
		expect(predicted).toBeLessThan(2600);
	});

	it("returns null on unusable input", () => {
		expect(riegel(0, 5000, 10000)).toBeNull();
		expect(riegel(1200, 0, 10000)).toBeNull();
	});
});

describe("vdot", () => {
	it("scores a faster run over the same distance higher", () => {
		expect(vdot(5000, 1200)).toBeGreaterThan(vdot(5000, 1500));
	});

	it("lands in a plausible range for a well-known performance", () => {
		// A 20-minute 5k is a widely cited VDOT ~49-50.
		expect(vdot(5000, 1200)).toBeGreaterThan(48);
		expect(vdot(5000, 1200)).toBeLessThan(51);
	});

	it("returns null on unusable input", () => {
		expect(vdot(0, 1200)).toBeNull();
	});
});

describe("timeForVdot", () => {
	it("round-trips a performance back to its own time", () => {
		const value = vdot(10000, 2500);
		expect(timeForVdot(value, 10000)).toBeCloseTo(2500, 0);
	});

	it("predicts a longer time for a longer distance", () => {
		const value = vdot(10000, 2500);
		expect(timeForVdot(value, MARATHON_M)).toBeGreaterThan(2500);
	});
});

describe("vdotProjection", () => {
	it("projects a half marathon to a slower marathon", () => {
		const half = 21097.5;
		const projected = vdotProjection(6000, half, MARATHON_M);
		expect(projected).toBeGreaterThan(12000);
	});
});

describe("predictFromEffort", () => {
	it("takes the slower of the two models", () => {
		const out = predictFromEffort({ timeSec: 6000, distanceM: 21097.5 }, MARATHON_M);
		expect(out.predictedSec).toBe(Math.max(out.riegelSec, out.vdotSec));
	});

	it("reports both models so the disagreement stays visible", () => {
		const out = predictFromEffort({ timeSec: 6000, distanceM: 21097.5 }, MARATHON_M);
		expect(out.riegelSec).toBeGreaterThan(0);
		expect(out.vdotSec).toBeGreaterThan(0);
		expect(out.vdot).toBeGreaterThan(0);
	});

	it("returns null when nothing can be projected", () => {
		expect(predictFromEffort({ timeSec: 0, distanceM: 0 }, MARATHON_M)).toBeNull();
	});
});

describe("predictRace", () => {
	it("picks the effort showing the best shape, not the most recent", () => {
		const out = predictRace(
			[
				{ distanceM: 10000, timeSec: 2700, date: "2026-08-01" }, // 45:00
				{ distanceM: 10000, timeSec: 2400, date: "2026-06-01" }, // 40:00, sharper
			],
			MARATHON_M,
		);
		expect(out.basis.timeSec).toBe(2400);
	});

	it("ignores efforts too short to say anything about a marathon", () => {
		const out = predictRace(
			[
				{ distanceM: 800, timeSec: 130 },
				{ distanceM: 10000, timeSec: 2700 },
			],
			MARATHON_M,
		);
		expect(out.basis.distanceM).toBe(10000);
	});

	it("returns null when every effort is too short", () => {
		expect(predictRace([{ distanceM: 1500, timeSec: 300 }], MARATHON_M)).toBeNull();
		expect(predictRace([], MARATHON_M)).toBeNull();
	});
});

describe("aerobicPotential", () => {
	it("matches a single-effort projection", () => {
		const effort = { distanceM: 10000, timeSec: 2400, date: "2026-08-01" };
		const single = predictFromEffort(effort, MARATHON_M);
		const out = aerobicPotential([effort], MARATHON_M, "2026-08-24");
		expect(out.predictedSec).toBeCloseTo(single.predictedSec, 0);
		expect(out.basis.distanceM).toBe(10000);
	});

	it("leans on the half when a 5k disagrees substantially", () => {
		const half = { distanceM: 21097.5, timeSec: 6300, date: "2026-08-10" };
		const five = { distanceM: 5000, timeSec: 1080, date: "2026-08-17" };
		const out = aerobicPotential([half, five], MARATHON_M, "2026-08-24");
		const halfSec = predictFromEffort(half, MARATHON_M).predictedSec;
		const fiveSec = predictFromEffort(five, MARATHON_M).predictedSec;
		expect(Math.abs(out.predictedSec - halfSec)).toBeLessThan(Math.abs(out.predictedSec - fiveSec));
	});
});

describe("goalDelta", () => {
	it("reports a positive delta when predicted to miss the goal", () => {
		const out = goalDelta(13800, GOAL_SEC);
		expect(out.deltaSec).toBe(600);
		expect(out.onTrack).toBe(false);
	});

	it("reports on track when predicted to beat the goal", () => {
		const out = goalDelta(12900, GOAL_SEC);
		expect(out.deltaSec).toBe(-300);
		expect(out.onTrack).toBe(true);
	});

	it("returns null on unusable input", () => {
		expect(goalDelta(null, GOAL_SEC)).toBeNull();
	});
});

describe("goalPaceSecPerKm", () => {
	it("computes 3:40 marathon pace as about 5:13/km", () => {
		expect(goalPaceSecPerKm(GOAL_SEC, MARATHON_M)).toBeCloseTo(312.8, 1);
	});
});
