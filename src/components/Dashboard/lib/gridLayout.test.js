import { describe, it, expect } from "vitest";
import { pack, chooseLayout } from "./gridLayout.js";

const DASHBOARD = [
	{ id: "clock", w: 2, h: 2 },
	{ id: "gallery", w: 1, h: 2 },
	{ id: "weather", w: 2, h: 2 },
	{ id: "spotify", w: 2, h: 1 },
	{ id: "strava", w: 2, h: 2 },
	{ id: "github", w: 2, h: 2 },
	{ id: "hn", w: 1, h: 2 },
];

/** Every cell of the grid, mapped to whichever widgets claim it. */
function coverage({ rows, cols, placements }) {
	const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => []));
	for (const [id, p] of Object.entries(placements)) {
		for (let r = p.y; r < p.y + p.h; r += 1) {
			for (let c = p.x; c < p.x + p.w; c += 1) cells[r][c].push(id);
		}
	}
	return cells.flat();
}

describe("pack", () => {
	it("places every widget, inside the grid, without overlap", () => {
		for (let cols = 1; cols <= 8; cols += 1) {
			const layout = pack(DASHBOARD, cols);
			expect(Object.keys(layout.placements)).toHaveLength(DASHBOARD.length);
			for (const p of Object.values(layout.placements)) {
				expect(p.x).toBeGreaterThanOrEqual(0);
				expect(p.x + p.w).toBeLessThanOrEqual(cols);
				expect(p.y + p.h).toBeLessThanOrEqual(layout.rows);
			}
			expect(coverage(layout).every((ids) => ids.length <= 1)).toBe(true);
		}
	});

	it("narrows a widget wider than the grid to fit it", () => {
		const { placements } = pack([{ id: "a", w: 3, h: 1 }], 2);
		expect(placements.a).toEqual({ x: 0, y: 0, w: 2, h: 1 });
	});

	it("fills gaps from the left, like a dense grid", () => {
		const { placements } = pack(
			[{ id: "a", w: 1, h: 1 }, { id: "b", w: 2, h: 1 }, { id: "c", w: 1, h: 1 }],
			2,
		);
		// b can't fit beside a, so c takes that spot ahead of it.
		expect(placements.c.y).toBe(0);
		expect(placements.b.y).toBe(1);
	});

	it("grows widgets into the gaps left over, so the grid has no holes", () => {
		const layout = pack([{ id: "a", w: 2, h: 2 }, { id: "b", w: 1, h: 1 }], 3);
		expect(layout.holes).toBe(0);
		expect(layout.placements.b).toEqual({ x: 2, y: 0, w: 1, h: 2 });
		expect(coverage(layout).every((ids) => ids.length === 1)).toBe(true);
	});

	it("packs the dashboard's widgets without holes at common column counts", () => {
		for (const cols of [1, 2, 4, 5, 6]) {
			expect(pack(DASHBOARD, cols).holes).toBe(0);
		}
	});

	it("places a pinned widget exactly, and packs the rest around it", () => {
		const { placements } = pack(DASHBOARD, 4, { pin: { id: "hn", x: 1, y: 3 } });
		expect(placements.hn).toMatchObject({ x: 1, y: 3, w: 1 });
		expect(placements.clock).toMatchObject({ x: 0, y: 0 });
	});

	it("handles an empty dashboard", () => {
		expect(pack([], 4)).toEqual({ cols: 4, rows: 0, holes: 0, placements: {} });
	});
});

describe("chooseLayout", () => {
	const gap = 16;

	it("fits a large window without scrolling", () => {
		const layout = chooseLayout(DASHBOARD, { width: 1856, height: 990, gap });
		expect(layout.fit).toBe(true);
		expect(layout.cols).toBeGreaterThanOrEqual(4);
	});

	it("goes wider and shorter for a wide, short window", () => {
		const tall = chooseLayout(DASHBOARD, { width: 1000, height: 1000, gap });
		const short = chooseLayout(DASHBOARD, { width: 1600, height: 480, gap });
		expect(short.fit).toBe(true);
		expect(short.cols).toBeGreaterThan(tall.cols);
		expect(short.rows).toBeLessThan(tall.rows);
	});

	it("squeezes rows down to the floor before it scrolls", () => {
		const squeezed = chooseLayout(DASHBOARD, { width: 896, height: 470, gap }, { rowMin: 64 });
		expect(squeezed.fit).toBe(true);
		expect(squeezed.rowHeight).toBeGreaterThanOrEqual(64);
		expect(squeezed.rowHeight).toBeLessThan(80);
	});

	it("scrolls at the floor row height once nothing fits", () => {
		const layout = chooseLayout(DASHBOARD, { width: 896, height: 300, gap }, { rowMin: 64, scrollRow: 64 });
		expect(layout.fit).toBe(false);
		expect(layout.rowHeight).toBe(64);
		// The widest grid the width allows is the shortest, so it scrolls least.
		expect(layout.cols).toBe(4);
	});

	it("stacks into one roomier column on a phone", () => {
		const layout = chooseLayout(DASHBOARD, { width: 358, height: 700, gap }, { stackRow: 130 });
		expect(layout.cols).toBe(1);
		expect(layout.fit).toBe(false);
		expect(layout.rowHeight).toBe(130);
	});

	it("never makes a column narrower than the minimum", () => {
		const layout = chooseLayout(DASHBOARD, { width: 650, height: 2000, gap }, { colMin: 200 });
		expect(layout.cols).toBeLessThanOrEqual(3);
	});

	it("returns an empty grid for no widgets", () => {
		const layout = chooseLayout([], { width: 1200, height: 800, gap });
		expect(layout.rows).toBe(0);
		expect(layout.fit).toBe(true);
	});
});
