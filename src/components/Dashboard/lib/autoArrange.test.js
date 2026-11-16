import { describe, it, expect } from "vitest";
import { autoArrange, scoreOrder } from "./autoArrange.js";
import { pack } from "./gridLayout.js";

const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]));
const holesOf = (items, order, cols) => pack(order.map((id) => byId(items)[id]), cols).holes;

describe("autoArrange", () => {
	it("fills the holes fixed widgets leave", () => {
		// In this order the 3-wide one can't sit beside the first 2-wide one,
		// so cells are stranded; paired 3+1 and 2+2, they tile.
		const items = [
			{ id: "a", w: 2, h: 1, fixed: true },
			{ id: "wide", w: 3, h: 1, fixed: true },
			{ id: "b", w: 1, h: 1, fixed: true },
			{ id: "c", w: 2, h: 1, fixed: true },
		];
		expect(holesOf(items, items.map((i) => i.id), 4)).toBeGreaterThan(0);
		const order = autoArrange(items, 4);
		expect(holesOf(items, order, 4)).toBe(0);
		expect([...order].sort()).toEqual(["a", "b", "c", "wide"]);
	});

	it("prefers fewer rows, so default-size widgets stretch less", () => {
		const items = [
			{ id: "tall", w: 1, h: 2 },
			{ id: "big", w: 2, h: 2, fixed: true },
			{ id: "s1", w: 1, h: 1, fixed: true },
			{ id: "s2", w: 1, h: 1, fixed: true },
			{ id: "s3", w: 1, h: 1, fixed: true },
		];
		const order = autoArrange(items, 3);
		const result = scoreOrder(order, byId(items), 3, order);
		expect(result.holes).toBe(0);
		expect(result.rows).toBe(3);
	});

	it("leaves a layout alone when nothing beats it", () => {
		const items = [
			{ id: "a", w: 2, h: 1, fixed: true },
			{ id: "b", w: 2, h: 1, fixed: true },
			{ id: "c", w: 2, h: 1, fixed: true },
		];
		expect(autoArrange(items, 2)).toEqual(["a", "b", "c"]);
	});

	it("gives the same answer when pressed twice", () => {
		const items = [
			{ id: "clock", w: 1, h: 1, fixed: true },
			{ id: "weather", w: 2, h: 2 },
			{ id: "running", w: 3, h: 2, fixed: true },
			{ id: "spotify", w: 2, h: 1 },
			{ id: "hn", w: 2, h: 3, fixed: true },
			{ id: "gallery", w: 1, h: 2 },
			{ id: "github", w: 2, h: 1, fixed: true },
		];
		const once = autoArrange(items, 5);
		const again = autoArrange(once.map((id) => byId(items)[id]), 5);
		expect(again).toEqual(once);
	});

	it("handles zero or one widget", () => {
		expect(autoArrange([], 4)).toEqual([]);
		expect(autoArrange([{ id: "a", w: 1, h: 1 }], 4)).toEqual(["a"]);
	});
});
