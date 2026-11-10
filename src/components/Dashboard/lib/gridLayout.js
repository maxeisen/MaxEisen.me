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
 * @param {{pin?: {id: string, x: number, y: number}}} [options] `pin` places
 *   one widget at an exact cell first (clamped to fit) and packs the rest
 *   around it; used to work out where a dragged widget can go.
 * @returns {{cols: number, rows: number, holes: number,
 *   placements: Record<string, {x: number, y: number, w: number, h: number}>}}
 */
export function pack(items, cols, { pin = null } = {}) {
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

	const pinned = pin && items.find((item) => item.id === pin.id);
	if (pinned) {
		const w = Math.max(1, Math.min(pinned.w, cols));
		const h = Math.max(1, pinned.h);
		const x = Math.max(0, Math.min(pin.x, cols - w));
		const y = Math.max(0, pin.y);
		claim(pinned.id, y, x, w, h);
		placements[pinned.id] = { x, y, w, h };
	}

	for (const item of items) {
		if (item === pinned) continue;
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
 * Pack into a given column count and size the rows for the box: shared
 * between them if that keeps every row at or above `rowMin`, otherwise at a
 * fixed height in a grid that scrolls.
 *
 * @param {{id: string, w: number, h: number}[]} items
 * @param {number} cols
 * @param {{height: number, gap: number}} box
 * @param {Partial<typeof GRID_DEFAULTS>} [options]
 * @returns {ReturnType<typeof pack> & {fit: boolean, rowHeight: number}}
 *   `fit` is true when the rows share the box's height; otherwise the grid
 *   is taller than the box, at a fixed `rowHeight`, and scrolls.
 */
export function layoutFor(items, cols, { height, gap }, options = {}) {
	const opts = { ...GRID_DEFAULTS, ...options };
	const packed = pack(items, cols);
	if (!packed.rows) return { ...packed, fit: true, rowHeight: 0 };
	const rowHeight = trackSize(height, packed.rows, gap);
	if (rowHeight >= opts.rowMin) return { ...packed, fit: true, rowHeight };
	return { ...packed, fit: false, rowHeight: cols === 1 ? opts.stackRow : opts.scrollRow };
}

/**
 * The column count that suits these widgets in this box: of every count the
 * width allows, the one whose cells come out closest to the ideal shape
 * while every row still clears `rowMin`; failing that, whichever is
 * shortest (it scrolls least).
 *
 * @param {{id: string, w: number, h: number}[]} items
 * @param {{width: number, height: number, gap: number}} box
 * @param {Partial<typeof GRID_DEFAULTS>} [options]
 * @returns {number}
 */
export function chooseColumns(items, { width, height, gap }, options = {}) {
	const opts = { ...GRID_DEFAULTS, ...options };
	const widest = Math.max(1, Math.min(opts.maxCols, Math.floor((width + gap) / (opts.colMin + gap))));
	if (!items.length) return widest;

	let bestFit = null;
	let bestScroll = null;
	for (let cols = 1; cols <= widest; cols += 1) {
		const packed = pack(items, cols);
		const rowHeight = trackSize(height, packed.rows, gap);
		const colWidth = trackSize(width, cols, gap);
		const score = Math.abs(Math.log(colWidth / rowHeight / opts.idealCellAspect))
			+ packed.holes * opts.holePenalty;
		const candidate = { cols, rows: packed.rows, score };

		if (rowHeight >= opts.rowMin) {
			if (!bestFit || score < bestFit.score) bestFit = candidate;
		} else if (
			!bestScroll
			|| packed.rows < bestScroll.rows
			|| (packed.rows === bestScroll.rows && score < bestScroll.score)
		) {
			bestScroll = candidate;
		}
	}
	return (bestFit || bestScroll).cols;
}

/**
 * Pick a column count for the box and pack into it.
 *
 * `options.colsFrom` decides the column count from a different list than the
 * one being packed. The dashboard passes the visible widgets in their
 * default order, so the count depends on which widgets are showing and how
 * big the window is, never on how someone has arranged them: rearranging
 * then moves widgets within a grid that holds still, instead of
 * occasionally re-gridding everything.
 *
 * @param {{id: string, w: number, h: number}[]} items
 * @param {{width: number, height: number, gap: number}} box the grid's
 *   content box in px, and the gap between tracks.
 * @param {Partial<typeof GRID_DEFAULTS> & {colsFrom?: typeof items}} [options]
 * @returns {ReturnType<typeof layoutFor>}
 */
export function chooseLayout(items, box, options = {}) {
	const { colsFrom = items, ...opts } = options;
	return layoutFor(items, chooseColumns(colsFrom, box, opts), box, opts);
}
