import { describe, it, expect } from "vitest";
import {
	DEFAULT_COLUMNS, defaultLayout, validateLayout, visibleLayout, computeRects, shares,
	resizeColumn, resizeRow, moveWidget, swapWidgets, dropTarget, stackedDropTarget, idsOf,
} from "./columnLayout.js";

const IDS = idsOf(DEFAULT_COLUMNS);
const L = [
	{ w: 1, items: [{ id: "a", h: 1 }, { id: "b", h: 1 }] },
	{ w: 2, items: [{ id: "c", h: 1 }] },
];

describe("defaultLayout / validateLayout", () => {
	it("starts from the default columns", () => {
		expect(idsOf(defaultLayout(IDS))).toEqual(IDS);
	});

	it("puts a widget the default lacks in the shortest column", () => {
		const out = defaultLayout([...IDS, "new"]);
		expect(idsOf(out)).toContain("new");
	});

	it("drops unknown, repeated and malformed entries, and fills in the missing", () => {
		const out = validateLayout({
			columns: [
				{ w: -1, items: [{ id: "a", h: 0 }, { id: "zzz", h: 1 }, { id: "a", h: 2 }, null] },
				{ w: 2, items: [] },
				"junk",
			],
		}, ["a", "b"]);
		expect(out).toEqual([{ w: 1, items: [{ id: "a", h: 1 }, { id: "b", h: 1 }] }]);
	});

	it("reads nothing usable as null", () => {
		expect(validateLayout(null, IDS)).toBeNull();
		expect(validateLayout({ columns: "x" }, IDS)).toBeNull();
		expect(validateLayout({ columns: [{ w: 1, items: [{ id: "zzz" }] }] }, IDS)).toBeNull();
	});
});

describe("visibleLayout", () => {
	it("drops hidden widgets and emptied columns", () => {
		expect(visibleLayout(L, (id) => id !== "c")).toEqual([L[0]]);
	});
});

describe("shares", () => {
	it("splits by weight into whole pixels that add up", () => {
		expect(shares([1, 3], 400, 10)).toEqual([100, 300]);
		const out = shares([1, 1, 1], 100, 10);
		expect(out.reduce((a, b) => a + b)).toBe(100);
	});

	it("never goes below the minimum, taking from the others", () => {
		expect(shares([1, 99], 400, 64)).toEqual([64, 336]);
	});

	it("gives everyone the minimum when that's all there is", () => {
		expect(shares([1, 1], 100, 64)).toEqual([64, 64]);
	});
});

describe("computeRects", () => {
	it("fills the box exactly, with gaps between", () => {
		const out = computeRects(L, { width: 616, height: 416 }, { gap: 16, minWidth: 100, minHeight: 50 });
		expect(out.stacked).toBe(false);
		expect(out.rects.a).toMatchObject({ x: 0, y: 0, w: 200, h: 200 });
		expect(out.rects.b).toMatchObject({ x: 0, y: 216, w: 200, h: 200 });
		expect(out.rects.c).toMatchObject({ x: 216, y: 0, w: 400, h: 416 });
		expect(out.height).toBe(416);
		expect(out.handles).toEqual([
			{ kind: "row", col: 0, index: 0, x: 0, y: 200, w: 200 },
			{ kind: "col", col: 0, x: 200, y: 0, h: 416 },
		]);
	});

	it("grows taller than the box (to scroll) rather than squash below the minimum", () => {
		const out = computeRects(L, { width: 616, height: 100 }, { gap: 16, minWidth: 100, minHeight: 64 });
		expect(out.rects.a.h).toBe(64);
		expect(out.height).toBe(64 + 16 + 64);
	});

	it("stacks into one list when the columns would be too narrow", () => {
		const out = computeRects(L, { width: 360, height: 800 }, { gap: 16, stackBelow: 200, stackMin: 130 });
		expect(out.stacked).toBe(true);
		expect(Object.values(out.rects).every((r) => r.x === 0 && r.w === 360)).toBe(true);
		expect(out.rects.c.y).toBeGreaterThan(out.rects.b.y);
	});
});

describe("resizing", () => {
	it("moves weight between two columns, keeping their total", () => {
		const boxes = [{ w: 200 }, { w: 400 }];
		const out = resizeColumn(L, L, boxes, 0, 100, 50);
		expect(out[0].w + out[1].w).toBeCloseTo(3);
		expect(out[0].w / out[1].w).toBeCloseTo(300 / 300);
	});

	it("stops a column at the minimum width", () => {
		const boxes = [{ w: 200 }, { w: 400 }];
		const out = resizeColumn(L, L, boxes, 0, 1000, 100);
		expect(out[0].w / out[1].w).toBeCloseTo(500 / 100);
	});

	it("moves weight between two widgets in a column", () => {
		const out = resizeRow(L, "a", "b", 200, 200, -100, 50);
		expect(out[0].items[0].h / out[0].items[1].h).toBeCloseTo(100 / 300);
		expect(out[0].items[0].h + out[0].items[1].h).toBeCloseTo(2);
	});
});

describe("moveWidget", () => {
	it("moves within and across columns, dropping emptied columns", () => {
		expect(idsOf(moveWidget(L, "b", { inColumnOf: "a", before: "a" }))).toEqual(["b", "a", "c"]);
		const out = moveWidget(L, "c", { inColumnOf: "a", before: null });
		expect(out).toHaveLength(1);
		expect(idsOf(out)).toEqual(["a", "b", "c"]);
	});

	it("starts a new column", () => {
		const out = moveWidget(L, "b", { newColumn: 1, visible: L });
		expect(out.map((col) => col.items.map((item) => item.id))).toEqual([["a"], ["b"], ["c"]]);
	});
});

describe("swapWidgets", () => {
	it("trades places", () => {
		expect(idsOf(swapWidgets(L, "a", "c"))).toEqual(["c", "b", "a"]);
	});
});

describe("dropTarget", () => {
	const layout = computeRects(L, { width: 616, height: 416 }, { gap: 16, minWidth: 100, minHeight: 50 });
	const board = { width: 616, edge: 30, gap: 16 };

	it("goes before the first widget whose middle is below the pointer", () => {
		expect(dropTarget({ x: 100, y: 50 }, layout, L, "c", board)).toEqual({ inColumnOf: "a", before: "a" });
		expect(dropTarget({ x: 100, y: 410 }, layout, L, "c", board)).toEqual({ inColumnOf: "a", before: null });
	});

	it("starts a new column at an edge or in a gap between columns", () => {
		expect(dropTarget({ x: 5, y: 100 }, layout, L, "a", board)).toMatchObject({ newColumn: 0 });
		expect(dropTarget({ x: 610, y: 100 }, layout, L, "a", board)).toMatchObject({ newColumn: 2 });
		expect(dropTarget({ x: 208, y: 100 }, layout, L, "a", board)).toMatchObject({ newColumn: 1 });
	});

	it("leaves a widget alone in its own column where it is", () => {
		expect(dropTarget({ x: 400, y: 100 }, layout, L, "c", board)).toBeNull();
	});
});

describe("stackedDropTarget", () => {
	it("follows the list order across columns", () => {
		const layout = computeRects(L, { width: 360, height: 800 }, { gap: 16, stackBelow: 200, stackMin: 130 });
		expect(stackedDropTarget({ x: 10, y: 0 }, layout, L, "c")).toEqual({ inColumnOf: "a", before: "a" });
		expect(stackedDropTarget({ x: 10, y: 99999 }, layout, L, "a")).toEqual({ inColumnOf: "c", before: null });
	});
});
