import { describe, it, expect } from "vitest";
import { packColumns } from "./packColumns.js";

// Helper: original indices per column.
const idxs = (cols) => cols.map((col) => col.map((c) => c.originalIdx));

describe("packColumns", () => {
	it("puts everything in one column when columnCount is 1", () => {
		const photos = [{}, {}, {}];
		expect(idxs(packColumns(photos, 1))).toEqual([[0, 1, 2]]);
	});

	it("fills the top row left-to-right in order (equal aspect ratios)", () => {
		const square = { width: 100, height: 100 };
		const photos = Array.from({ length: 8 }, () => ({ ...square }));
		const cols = packColumns(photos, 4);
		// top row reads 0,1,2,3 across the columns…
		expect([cols[0][0].originalIdx, cols[1][0].originalIdx, cols[2][0].originalIdx, cols[3][0].originalIdx]).toEqual([
			0, 1, 2, 3,
		]);
		// …then the second row 4,5,6,7
		expect(idxs(cols)).toEqual([
			[0, 4],
			[1, 5],
			[2, 6],
			[3, 7],
		]);
	});

	it("sends the next photo to the shortest column", () => {
		// col0 gets a very tall first photo; subsequent photos should avoid it.
		const tall = { width: 100, height: 400 }; // ratio 4
		const wide = { width: 100, height: 50 }; // ratio 0.5
		const photos = [tall, wide, wide, wide];
		const cols = packColumns(photos, 2);
		// idx0 (tall) -> col0. idx1 -> col1 (shorter). idx2 -> col1 still shorter
		// than col0's 4.0. idx3 -> col1 (0.5+0.5+0.5=1.5 < 4.0).
		expect(idxs(cols)).toEqual([[0], [1, 2, 3]]);
	});

	it("treats photos without dimensions as squares (height 1)", () => {
		const photos = [{}, {}, {}, {}];
		expect(idxs(packColumns(photos, 2))).toEqual([
			[0, 2],
			[1, 3],
		]);
	});

	it("returns columnCount empty arrays for no photos", () => {
		expect(packColumns([], 3)).toEqual([[], [], []]);
	});

	it("clamps a column count below 1 to a single column", () => {
		expect(idxs(packColumns([{}, {}], 0))).toEqual([[0, 1]]);
	});

	it("preserves the photo object alongside its original index", () => {
		const p = { public_id: "x", width: 10, height: 10 };
		expect(packColumns([p], 1)[0][0]).toEqual({ p, originalIdx: 0 });
	});
});
