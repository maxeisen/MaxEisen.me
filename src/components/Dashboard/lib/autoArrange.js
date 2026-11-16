// Finds an order for the dashboard's widgets that leaves as little empty
// space as possible, for the "Auto-arrange" button.
//
// The layout is an order that gridLayout packs, so arranging means choosing
// an order. Space is wasted in two ways:
//   - holes: cells nobody fills. Only a widget someone sized (`fixed`) can
//     leave one, since widgets at their default size grow into gaps.
//   - stretch: cells a default-size widget was grown into. It isn't empty,
//     but the widget is bigger than it asked to be.
// Holes count most. After that, fewer rows is better: with the column count
// fixed, fewer rows means less stretch and taller rows for every widget.
// Last, among equally good orders, the one closest to the current order
// wins, so pressing the button twice changes nothing the second time.
//
// Packing is cheap (well under a millisecond), so this tries a few sensible
// starting orders plus some shuffles, and improves each by moving or
// swapping widgets until no single move or swap helps. The shuffles use a
// fixed seed, so the same widgets always get the same answer.
//
// Plain JS, no DOM.

import { pack } from "./gridLayout.js";
import { moveTo } from "./gridReorder.js";

/** How far an order is from another: the sum of each id's index shift. */
function distance(order, from) {
	const at = new Map(from.map((id, i) => [id, i]));
	return order.reduce((sum, id, i) => sum + Math.abs(i - (at.get(id) ?? i)), 0);
}

/**
 * Score an order; lower is better. Compared field by field.
 *
 * @returns {{holes: number, rows: number, moved: number}}
 */
export function scoreOrder(order, byId, cols, current) {
	const { holes, rows } = pack(order.map((id) => byId[id]), cols);
	return { holes, rows, moved: distance(order, current) };
}

function better(a, b) {
	if (a.holes !== b.holes) return a.holes < b.holes;
	if (a.rows !== b.rows) return a.rows < b.rows;
	return a.moved < b.moved;
}

function swapped(order, i, j) {
	const next = [...order];
	[next[i], next[j]] = [next[j], next[i]];
	return next;
}

/** Move and swap widgets until no single move or swap improves the score. */
function improve(start, byId, cols, current) {
	let order = start;
	let score = scoreOrder(order, byId, cols, current);
	const tryOrder = (next) => {
		const nextScore = scoreOrder(next, byId, cols, current);
		if (!better(nextScore, score)) return false;
		order = next;
		score = nextScore;
		return true;
	};
	let improved = true;
	while (improved) {
		improved = false;
		for (const id of start) {
			for (let to = 0; to < order.length; to += 1) {
				if (order[to] !== id && tryOrder(moveTo(order, id, to))) improved = true;
			}
		}
		for (let i = 0; i < order.length; i += 1) {
			for (let j = i + 1; j < order.length; j += 1) {
				if (tryOrder(swapped(order, i, j))) improved = true;
			}
		}
	}
	return { order, score };
}

/** A small seeded random generator (mulberry32), for repeatable shuffles. */
function seeded(seed) {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffled(ids, random) {
	const out = [...ids];
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

const SHUFFLES = 24;

/**
 * The best order found for these widgets in this many columns.
 *
 * @param {{id: string, w: number, h: number, fixed?: boolean}[]} items the
 *   visible widgets, in their current order.
 * @param {number} cols
 * @returns {string[]} the same ids, reordered.
 */
export function autoArrange(items, cols) {
	const current = items.map((item) => item.id);
	if (items.length < 2) return current;
	const byId = Object.fromEntries(items.map((item) => [item.id, item]));
	const w = (item) => Math.min(item.w, cols);
	const sorted = (compare) => [...items].sort(compare).map((item) => item.id);

	// Starting points: as things are, and the classic packing orders
	// (biggest first, tallest first, widest first). Array sort is stable,
	// so ties keep the current order.
	const starts = [
		current,
		sorted((a, b) => w(b) * b.h - w(a) * a.h),
		sorted((a, b) => b.h - a.h || w(b) - w(a)),
		sorted((a, b) => w(b) - w(a) || b.h - a.h),
	];
	const random = seeded(1);
	for (let i = 0; i < SHUFFLES; i += 1) starts.push(shuffled(current, random));

	let best = null;
	for (const start of starts) {
		const found = improve(start, byId, cols, current);
		if (!best || better(found.score, best.score)) best = found;
	}
	return best.order;
}
