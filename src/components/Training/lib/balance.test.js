import { describe, it, expect } from "vitest";
import { bestSplit, columnHeight, imbalanceAt, worthMoving } from "./balance.js";

describe("columnHeight", () => {
	it("counts the gaps between panels, not around them", () => {
		expect(columnHeight([100, 100, 100], 10)).toBe(320);
		expect(columnHeight([100], 10)).toBe(100);
		expect(columnHeight([], 10)).toBe(0);
	});
});

describe("bestSplit", () => {
	it("splits evenly when the panels are even", () => {
		expect(bestSplit([100, 100, 100, 100], { min: 1 })).toBe(2);
	});

	it("puts one tall panel against several short ones", () => {
		// The whole point: a fixed halfway split would leave 600px beside 60.
		expect(bestSplit([600, 20, 20, 20, 20, 20, 20], { min: 1 })).toBe(1);
	});

	it("moves the boundary when a panel is added rather than staying put", () => {
		const before = [200, 200, 200, 200];
		expect(bestSplit(before, { min: 1 })).toBe(2);
		expect(bestSplit([...before, 400], { min: 1 })).toBe(3);
	});

	it("accounts for the gaps, which a long column has more of", () => {
		// Six panels of 100 against two of 300: equal in panels, but the
		// six carry five gaps and the two carry one.
		expect(bestSplit([100, 100, 100, 100, 100, 100, 300, 300], { gap: 40, min: 1 })).toBe(5);
	});

	it("won't strand a single panel on its own", () => {
		// Balanced to the pixel and obviously wrong to look at.
		expect(bestSplit([900, 100, 100, 100, 100, 100, 100, 100, 100, 100])).toBe(2);
	});

	it("gives up rather than guessing when a panel hasn't been measured", () => {
		// Mid-render, an unmeasured panel reads zero, and a zero would drag
		// the split somewhere arbitrary and visibly wrong.
		expect(bestSplit([100, NaN, 100, 100])).toBeNull();
		expect(bestSplit([100, 100])).toBeNull();
	});

	it("prefers the earlier of two equally good splits", () => {
		// Otherwise the result depends on loop direction, and a layout that
		// flips between two identical arrangements is a layout that jitters.
		expect(bestSplit([100, 100, 100, 100, 100, 100], { min: 1 })).toBe(3);
	});
});

describe("worthMoving", () => {
	const heights = [300, 300, 300, 100];

	it("moves for a real improvement", () => {
		expect(worthMoving(heights, 3, 2, { minGain: 64 })).toBe(true);
	});

	it("stays put for a small one", () => {
		// A panel changes height when it changes column, so a marginal gain
		// is as likely to be measurement noise as an actual improvement —
		// and acting on it is how a layout ends up oscillating.
		expect(worthMoving([200, 200, 210, 200], 2, 3, { minGain: 64 })).toBe(false);
	});

	it("never moves to where it already is", () => {
		expect(worthMoving(heights, 2, 2)).toBe(false);
		expect(worthMoving(heights, 2, null)).toBe(false);
	});
});
