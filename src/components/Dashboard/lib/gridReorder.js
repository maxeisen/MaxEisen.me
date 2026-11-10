// Where a dragged widget should go, given where it's being held.
//
// The dashboard's layout is an order, packed into the grid (gridLayout), so
// "drop it here" has to be translated into "put it at this point in the
// order". That translation is done by trying it: move the widget to each
// position in the order, pack, and keep the position that lands it nearest
// the cell it's being held over. The page shows that result as a live
// preview, so what you see while dragging is exactly what you get on drop.
//
// Plain JS, no DOM: the page hands in pointer positions and grid geometry.

import { pack } from "./gridLayout.js";

/** `ids` with `id` moved to `index` (an index into the result). */
export function moveTo(ids, id, index) {
	const rest = ids.filter((other) => other !== id);
	const at = Math.max(0, Math.min(index, rest.length));
	return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/**
 * Fold a new order of the visible widgets back into the full saved order.
 * Hidden widgets keep their positions; the positions the visible ones held
 * are refilled in their new sequence. Showing a hidden widget again
 * therefore still puts it back where it was.
 *
 * @param {string[]} full every widget id, in saved order.
 * @param {string[]} visible the visible ids, in their new order.
 * @returns {string[]}
 */
export function mergeOrder(full, visible) {
	const moving = new Set(visible);
	const queue = [...visible];
	return full.map((id) => (moving.has(id) ? queue.shift() : id));
}

/**
 * The grid cell under a point.
 *
 * @param {{x: number, y: number}} point viewport px.
 * @param {{left: number, top: number, colPitch: number, rowPitch: number}} grid
 *   the grid's origin and the distance from one track's start to the next.
 * @returns {{col: number, row: number}} may be outside the grid.
 */
export function cellAt(point, { left, top, colPitch, rowPitch }) {
	return {
		col: Math.floor((point.x - left) / colPitch),
		row: Math.floor((point.y - top) / rowPitch),
	};
}

/** Ids in reading order of their placements: top to bottom, then left to right. */
export function readingOrder(placements) {
	return Object.entries(placements)
		.sort(([, a], [, b]) => a.y - b.y || a.x - b.x)
		.map(([id]) => id);
}

/**
 * The order that lands `id` nearest the cell its top-left is held over.
 *
 * Candidates are every position in the order for the dragged widget, plus
 * one more: the widget pinned exactly where it's held with everything else
 * packed around it, read back off the grid as an order. That last one is
 * what reaches spots no single move in the order can (a 2-wide widget
 * pushed right of a narrow one, say). Each candidate is judged by where an
 * ordinary pack of it puts the widget, because an order is all that's
 * saved: the preview has to be what a reload will show. Leaving a hole in
 * the grid counts against a candidate too.
 *
 * @param {object} input
 * @param {{id: string, w: number, h: number}[]} input.items visible widgets,
 *   in their current order.
 * @param {string} input.id the widget being dragged.
 * @param {{col: number, row: number}} input.target where the widget's
 *   top-left corner is being held.
 * @param {number} input.cols
 * @returns {{order: string[], placement: {x: number, y: number, w: number, h: number}}}
 */
export function bestDrop({ items, id, target, cols }) {
	const ids = items.map((item) => item.id);
	const byId = Object.fromEntries(items.map((item) => [item.id, item]));
	const w = Math.min(byId[id].w, cols);
	const col = Math.max(0, Math.min(target.col, cols - w));
	const row = Math.max(0, target.row);

	const candidates = ids.map((_, index) => moveTo(ids, id, index));
	candidates.push(readingOrder(pack(items, cols, { pin: { id, x: col, y: row } }).placements));

	let best = null;
	for (const order of candidates) {
		const { placements, holes } = pack(order.map((other) => byId[other]), cols);
		const placement = placements[id];
		// Rows count double: landing a row out reads as further off than a
		// column out, since the grid is usually wider than it is tall. A
		// gap left in the grid costs as much as landing a column out: a
		// near-miss beats an exact landing that leaves a hole.
		const distance = Math.abs(placement.x - col) + 2 * Math.abs(placement.y - row) + holes;
		// Ties go to the order that disturbs the fewest other widgets, so a
		// widget held still stays put.
		const moved = order.reduce((n, other, i) => n + (other !== ids[i] ? 1 : 0), 0);
		if (!best || distance < best.distance || (distance === best.distance && moved < best.moved)) {
			best = { order, placement, distance, moved };
		}
	}
	return { order: best.order, placement: best.placement };
}
