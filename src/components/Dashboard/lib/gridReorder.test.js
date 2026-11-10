import { describe, it, expect } from "vitest";
import { moveTo, mergeOrder, cellAt, bestDrop } from "./gridReorder.js";
import { pack, chooseLayout } from "./gridLayout.js";

describe("moveTo", () => {
	it("moves an id to an index in the result", () => {
		expect(moveTo(["a", "b", "c", "d"], "a", 2)).toEqual(["b", "c", "a", "d"]);
		expect(moveTo(["a", "b", "c", "d"], "d", 0)).toEqual(["d", "a", "b", "c"]);
		expect(moveTo(["a", "b", "c"], "b", 9)).toEqual(["a", "c", "b"]);
	});
});

describe("mergeOrder", () => {
	it("keeps hidden ids where they were and refills the rest in order", () => {
		// x is hidden; c moved to the front of the visible ones.
		expect(mergeOrder(["a", "x", "b", "c"], ["c", "a", "b"])).toEqual(["c", "x", "a", "b"]);
	});
});

describe("cellAt", () => {
	const grid = { left: 100, top: 50, colPitch: 216, rowPitch: 96 };
	it("maps a point to the cell it falls in", () => {
		expect(cellAt({ x: 100, y: 50 }, grid)).toEqual({ col: 0, row: 0 });
		expect(cellAt({ x: 100 + 216 * 2 + 5, y: 50 + 96 * 3 + 1 }, grid)).toEqual({ col: 2, row: 3 });
	});
	it("can fall outside the grid", () => {
		expect(cellAt({ x: 0, y: 0 }, grid)).toEqual({ col: -1, row: -1 });
	});
});

const DASHBOARD = [
	{ id: "clock", w: 2, h: 2 },
	{ id: "gallery", w: 1, h: 2 },
	{ id: "weather", w: 2, h: 2 },
	{ id: "spotify", w: 2, h: 1 },
	{ id: "strava", w: 2, h: 2 },
	{ id: "github", w: 2, h: 2 },
	{ id: "hn", w: 1, h: 2 },
];

describe("bestDrop", () => {
	const cols = 4;
	const at = (id) => pack(DASHBOARD, cols).placements[id];

	it("leaves a widget held over its own spot where it is", () => {
		const { x, y } = at("weather");
		const { order } = bestDrop({ items: DASHBOARD, id: "weather", target: { col: x, row: y }, cols });
		expect(order).toEqual(DASHBOARD.map((item) => item.id));
	});

	it("lands most drops on, or next to, the cell aimed at, rarely leaving a gap", () => {
		// Every widget, held with its top-left over every cell it could
		// occupy. An order is all that's saved, and dense packing can't put
		// a narrow widget just anywhere, so not every spot is reachable; and
		// a near-miss is preferred to an exact landing that leaves a hole.
		const byId = Object.fromEntries(DASHBOARD.map((item) => [item.id, item]));
		let close = 0;
		let gappy = 0;
		let total = 0;
		const rows = pack(DASHBOARD, cols).rows;
		for (const { id, w, h } of DASHBOARD) {
			for (let row = 0; row + h <= rows; row += 1) {
				for (let col = 0; col + Math.min(w, cols) <= cols; col += 1) {
					const { placement, order } = bestDrop({ items: DASHBOARD, id, target: { col, row }, cols });
					total += 1;
					if (Math.abs(placement.x - col) + Math.abs(placement.y - row) <= 1) close += 1;
					if (pack(order.map((other) => byId[other]), cols).holes) gappy += 1;
				}
			}
		}
		expect(close / total).toBeGreaterThan(0.8);
		expect(gappy / total).toBeLessThan(0.1);
	});

	it("reaches a spot no single move in the order can", () => {
		// The clock to the right of Photos in the top row: only the pinned
		// candidate (Photos first, then the clock) gets it there.
		const { placement, order } = bestDrop({ items: DASHBOARD, id: "clock", target: { col: 1, row: 0 }, cols });
		expect(placement).toMatchObject({ x: 1, y: 0 });
		expect(order.indexOf("gallery")).toBeLessThan(order.indexOf("clock"));
	});

	it("moves the clock to the bottom-right when it's held there", () => {
		const { placement, order } = bestDrop({ items: DASHBOARD, id: "clock", target: { col: 2, row: 4 }, cols });
		expect(placement.x).toBe(2);
		expect(placement.y).toBeGreaterThanOrEqual(3);
		expect(order[0]).not.toBe("clock");
	});

	it("clamps a target off the grid's edge to the nearest place it fits", () => {
		const { placement } = bestDrop({ items: DASHBOARD, id: "clock", target: { col: 9, row: -3 }, cols });
		expect(placement.y).toBe(0);
		expect(placement.x).toBeGreaterThanOrEqual(1);
	});

	it("returns the placement the preview will actually show", () => {
		const { order, placement } = bestDrop({ items: DASHBOARD, id: "hn", target: { col: 0, row: 0 }, cols });
		const byId = Object.fromEntries(DASHBOARD.map((item) => [item.id, item]));
		expect(pack(order.map((id) => byId[id]), cols).placements.hn).toEqual(placement);
	});
});

describe("chooseLayout colsFrom", () => {
	it("decides columns from the given list, so reordering can't re-grid", () => {
		const box = { width: 1200, height: 800, gap: 16 };
		const canonical = chooseLayout(DASHBOARD, box);
		const reversed = [...DASHBOARD].reverse();
		expect(chooseLayout(reversed, box, { colsFrom: DASHBOARD }).cols).toBe(canonical.cols);
	});
});
