// Lays the dashboard's widgets out for whatever box the window gives it.
//
// Each widget declares a size in grid units ({w, h}) — the more it has to
// say, the bigger it is. Given the room available, chooseLayout tries every
// column count the width allows, packs the widgets into each, and keeps the
// one whose cells come out closest to a comfortable shape while every row
// still clears ROW_MIN. A wide, short window therefore gets more columns and
// fewer rows; a tall, narrow one the reverse. Only when no column count can
// keep rows above ROW_MIN does the grid give up on fitting and scroll.
//
// Plain JS with no DOM access, so the interesting decisions are unit-tested.

export const GRID_DEFAULTS = {
	// The floor a fitted row can shrink to before the grid scrolls instead.
	// Deliberately low: squeezing is preferred to scrolling, and widgets have
	// compact tiers for these sizes.
	rowMin: 64,
	// Narrowest a column may get; caps the column count for a given width.
	colMin: 200,
	maxCols: 8,
	// Width:height of one grid cell the chooser aims for. A 2×2 widget comes
	// out at roughly the same shape.
	idealCellAspect: 1.8,
	// Row height once the grid has given up fitting and scrolls: the same
	// floor, so shrinking the window past that point doesn't suddenly blow
	// every widget back up. A single column (a phone) is a scrolling page
	// from the start, so it gets roomier rows.
	scrollRow: 64,
	stackRow: 130,
	// Score cost per cell left empty after growing widgets into gaps.
	holePenalty: 0.15,
};

/**
 * Pack widgets into `cols` columns, first-fit from the top-left in order
 * (like CSS `grid-auto-flow: dense`), then grow widgets sideways and down
 * into any cells left empty so the grid comes out as a full rectangle.
 *
 * @param {{id: string, w: number, h: number}[]} items in layout order.
 * @param {number} cols
 * @returns {{cols: number, rows: number, holes: number,
 *   placements: Record<string, {x: number, y: number, w: number, h: number}>}}
 */
export function pack(items, cols) {
	const cells = [];
	const placements = {};
	const occupied = (r, c) => cells[r]?.[c] != null;

	const ensureRows = (n) => {
		while (cells.length < n) cells.push(new Array(cols).fill(null));
	};
	const fits = (r, c, w, h) => {
		for (let rr = r; rr < r + h; rr += 1) {
			for (let cc = c; cc < c + w; cc += 1) {
				if (occupied(rr, cc)) return false;
			}
		}
		return true;
	};
	const claim = (id, r, c, w, h) => {
		ensureRows(r + h);
		for (let rr = r; rr < r + h; rr += 1) {
			for (let cc = c; cc < c + w; cc += 1) cells[rr][cc] = id;
		}
	};

	for (const item of items) {
		const w = Math.max(1, Math.min(item.w, cols));
		const h = Math.max(1, item.h);
		let placed = false;
		for (let r = 0; !placed; r += 1) {
			for (let c = 0; c + w <= cols; c += 1) {
				if (fits(r, c, w, h)) {
					claim(item.id, r, c, w, h);
					placements[item.id] = { x: c, y: r, w, h };
					placed = true;
					break;
				}
			}
		}
	}

	const rows = cells.length;
	const grid = cells;
	const columnFree = (c, r, h) => {
		for (let rr = r; rr < r + h; rr += 1) if (grid[rr][c] != null) return false;
		return true;
	};
	const rowFree = (r, c, w) => {
		for (let cc = c; cc < c + w; cc += 1) if (grid[r][cc] != null) return false;
		return true;
	};

	// Grow into gaps until nothing moves. Sideways first, so a short widget
	// at the end of a row widens rather than the one above it stretching
	// down; widgets earlier in the order get first claim.
	let changed = true;
	while (changed) {
		changed = false;
		for (const item of items) {
			const p = placements[item.id];
			while (p.x + p.w < cols && columnFree(p.x + p.w, p.y, p.h)) {
				for (let rr = p.y; rr < p.y + p.h; rr += 1) grid[rr][p.x + p.w] = item.id;
				p.w += 1;
				changed = true;
			}
		}
		for (const item of items) {
			const p = placements[item.id];
			while (p.y + p.h < rows && rowFree(p.y + p.h, p.x, p.w)) {
				for (let cc = p.x; cc < p.x + p.w; cc += 1) grid[p.y + p.h][cc] = item.id;
				p.h += 1;
				changed = true;
			}
		}
	}

	let holes = 0;
	for (const row of grid) for (const cell of row) if (cell == null) holes += 1;

	return { cols, rows, holes, placements };
}

function trackSize(total, count, gap) {
	return (total - gap * (count - 1)) / count;
}

/**
 * Pick a column count for the box and pack into it.
 *
 * @param {{id: string, w: number, h: number}[]} items
 * @param {{width: number, height: number, gap: number}} box the grid's
 *   content box in px, and the gap between tracks.
 * @param {Partial<typeof GRID_DEFAULTS>} [options]
 * @returns {ReturnType<typeof pack> & {fit: boolean, rowHeight: number}}
 *   `fit` is true when the rows share the box's height; otherwise the grid
 *   is taller than the box, at a fixed `rowHeight`, and scrolls.
 */
export function chooseLayout(items, { width, height, gap }, options = {}) {
	const opts = { ...GRID_DEFAULTS, ...options };
	const widest = Math.max(1, Math.min(opts.maxCols, Math.floor((width + gap) / (opts.colMin + gap))));

	if (!items.length) {
		return { ...pack([], widest), fit: true, rowHeight: 0 };
	}

	let bestFit = null;
	let bestScroll = null;
	for (let cols = 1; cols <= widest; cols += 1) {
		const packed = pack(items, cols);
		const rowHeight = trackSize(height, packed.rows, gap);
		const colWidth = trackSize(width, cols, gap);
		const score = Math.abs(Math.log(colWidth / rowHeight / opts.idealCellAspect))
			+ packed.holes * opts.holePenalty;
		const candidate = { ...packed, score, rowHeight };

		if (rowHeight >= opts.rowMin) {
			if (!bestFit || score < bestFit.score) bestFit = candidate;
		} else if (
			// Scrolling either way: the shortest grid scrolls least.
			!bestScroll
			|| packed.rows < bestScroll.rows
			|| (packed.rows === bestScroll.rows && score < bestScroll.score)
		) {
			bestScroll = candidate;
		}
	}

	if (bestFit) {
		const { score, ...layout } = bestFit;
		return { ...layout, fit: true };
	}
	const { score, ...layout } = bestScroll;
	return {
		...layout,
		fit: false,
		rowHeight: layout.cols === 1 ? opts.stackRow : opts.scrollRow,
	};
}
