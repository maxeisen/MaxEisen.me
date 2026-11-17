// The dashboard's layout: columns of widgets, each sized by dragging the
// gaps between them.
//
//   { columns: [{ w, items: [{ id, h }] }] }
//
// `w` and `h` are weights, not pixels or grid units: a column gets
// w / (sum of w) of the width, and a widget gets h / (sum of h in its
// column) of the column's height. So the layout always fills the window
// exactly, with no holes, and squeezing the window scales every widget
// together. Dragging a gap moves weight from one neighbour to the other.
//
// Hidden and unavailable widgets keep their place (and weight) in the
// saved layout but take no room: showing one again puts it back where it
// was, at the size it had.
//
// Plain JS, no DOM: the page measures, this decides.

const LAYOUT_DEFAULTS = {
	gap: 16,
	// Smallest a widget may be dragged to. Widgets have compact tiers down
	// to here (e2e/dashboard.e2e.js checks them).
	minWidth: 200,
	minHeight: 64,
	// Below this many px per column, the columns stack into one scrolling
	// list (a phone, or a very narrow window).
	stackBelow: 200,
	// Height of a stacked widget, as a share of the window it would have had
	// in its column, but never less than this.
	stackMin: 130,
};

/**
 * The layout a new visitor sees. Widgets missing from it (added to the
 * registry later) go to the end of the shortest column.
 */
export const DEFAULT_COLUMNS = [
	{ w: 1, items: [{ id: "clock", h: 0.7 }, { id: "weather", h: 1.3 }, { id: "forecast", h: 0.8 }] },
	{ w: 1.3, items: [{ id: "running", h: 1.2 }, { id: "cycling", h: 1 }, { id: "week", h: 0.6 }] },
	{ w: 1.1, items: [{ id: "strava", h: 1.4 }, { id: "recovery", h: 0.6 }, { id: "spotify", h: 0.7 }] },
	{ w: 1, items: [{ id: "hn", h: 1.3 }, { id: "github", h: 0.8 }, { id: "gallery", h: 0.9 }, { id: "clocks", h: 0.6 }] },
];

const clone = (columns) => columns.map((col) => ({ w: col.w, items: col.items.map((item) => ({ ...item })) }));
const positive = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;

/** Every id in the layout, column by column. */
export function idsOf(columns) {
	return columns.flatMap((col) => col.items.map((item) => item.id));
}

/** Add any of `ids` the layout lacks: to its default column if it has one, else the shortest. */
function withMissing(columns, ids) {
	const out = clone(columns);
	const have = new Set(idsOf(out));
	for (const id of ids) {
		if (have.has(id)) continue;
		const home = DEFAULT_COLUMNS.findIndex((col) => col.items.some((item) => item.id === id));
		const target = home >= 0 && home < out.length
			? out[home]
			: out.reduce((a, b) => (b.items.length < a.items.length ? b : a), out[0]);
		if (!target) out.push({ w: 1, items: [{ id, h: 1 }] });
		else target.items.push({ id, h: 1 });
		have.add(id);
	}
	return out;
}

/** The default layout for these widget ids. */
export function defaultLayout(ids) {
	const known = new Set(ids);
	const columns = DEFAULT_COLUMNS
		.map((col) => ({ w: col.w, items: col.items.filter((item) => known.has(item.id)) }))
		.filter((col) => col.items.length);
	return withMissing(columns, ids);
}

/**
 * Reconcile a stored layout with the widgets the page has today: drop
 * unknown or repeated ids and bad weights, add any widget it lacks.
 *
 * @returns {{w: number, items: {id: string, h: number}[]}[] | null} null
 *   when there's nothing usable to read.
 */
export function validateLayout(stored, ids) {
	const columns = stored?.columns;
	if (!Array.isArray(columns)) return null;
	const known = new Set(ids);
	const seen = new Set();
	const clean = [];
	for (const col of columns) {
		if (!col || !Array.isArray(col.items)) continue;
		const items = [];
		for (const item of col.items) {
			if (!item || !known.has(item.id) || seen.has(item.id)) continue;
			seen.add(item.id);
			items.push({ id: item.id, h: positive(item.h) ? item.h : 1 });
		}
		if (items.length) clean.push({ w: positive(col.w) ? col.w : 1, items });
	}
	if (!clean.length) return null;
	return withMissing(clean, ids);
}

/** Only the widgets that take room, in only the columns that still have one. */
export function visibleLayout(columns, isVisible) {
	return columns
		.map((col) => ({ w: col.w, items: col.items.filter((item) => isVisible(item.id)) }))
		.filter((col) => col.items.length);
}

/**
 * Pixel boxes for every visible widget, and the gaps between them (the
 * handles that resize).
 *
 * @param {{w: number, items: {id: string, h: number}[]}[]} columns visible only.
 * @param {{width: number, height: number}} box the area to fill, in px.
 * @param {Partial<typeof LAYOUT_DEFAULTS>} [options]
 * @returns {{
 *   stacked: boolean,
 *   height: number,
 *   rects: Record<string, {x: number, y: number, w: number, h: number, col: number, index: number}>,
 *   columns: {x: number, w: number}[],
 *   handles: ({kind: "col", col: number, x: number, y: number, h: number}
 *     | {kind: "row", col: number, index: number, x: number, y: number, w: number})[],
 * }} `height` is the content's height: more than the box when it scrolls.
 */
export function computeRects(columns, { width, height }, options = {}) {
	const opts = { ...LAYOUT_DEFAULTS, ...options };
	const { gap } = opts;
	const rects = {};
	const handles = [];
	const colBoxes = [];
	if (!columns.length) return { stacked: false, height: 0, rects, columns: colBoxes, handles };

	const usable = width - gap * (columns.length - 1);
	const stacked = columns.length > 1 && usable / columns.length < opts.stackBelow;

	if (stacked) {
		// One scrolling list, column by column. Each widget keeps roughly the
		// share of a screen it had in its column.
		let y = 0;
		columns.forEach((col, c) => {
			const total = col.items.reduce((s, item) => s + item.h, 0);
			col.items.forEach((item, i) => {
				const h = Math.max(opts.stackMin, Math.round((height * item.h) / total));
				rects[item.id] = { x: 0, y, w: width, h, col: c, index: i };
				y += h + gap;
			});
		});
		return { stacked: true, height: Math.max(0, y - gap), rects, columns: [{ x: 0, w: width }], handles };
	}

	// Column widths: shares of the usable width, none below the minimum.
	const widths = shares(columns.map((col) => col.w), usable, opts.minWidth);
	let x = 0;
	let contentHeight = height;
	columns.forEach((col, c) => {
		const w = widths[c];
		colBoxes.push({ x, w });
		if (c > 0) handles.push({ kind: "col", col: c - 1, x: x - gap, y: 0, h: height });
		const usableH = height - gap * (col.items.length - 1);
		const heights = shares(col.items.map((item) => item.h), usableH, opts.minHeight);
		let y = 0;
		col.items.forEach((item, i) => {
			if (i > 0) handles.push({ kind: "row", col: c, index: i - 1, x, y: y - gap, w });
			rects[item.id] = { x, y, w, h: heights[i], col: c, index: i };
			y += heights[i] + gap;
		});
		contentHeight = Math.max(contentHeight, y - gap);
		x += w + gap;
	});
	for (const handle of handles) if (handle.kind === "col") handle.h = contentHeight;
	return { stacked: false, height: contentHeight, rects, columns: colBoxes, handles };
}

/**
 * Split `total` px in proportion to `weights`, none below `min`, as whole
 * pixels that add up to the total (or to the minimums, when they don't fit).
 */
export function shares(weights, total, min) {
	const n = weights.length;
	if (total <= n * min) return weights.map(() => min);
	// Give the minimum to any that fall under it, and share the rest among
	// the others; repeat until nobody is under.
	const pinned = new Array(n).fill(false);
	let out;
	for (;;) {
		const freeWeight = weights.reduce((s, w, i) => (pinned[i] ? s : s + w), 0);
		const freeTotal = total - pinned.filter(Boolean).length * min;
		out = weights.map((w, i) => (pinned[i] ? min : (freeTotal * w) / freeWeight));
		const under = out.findIndex((v, i) => !pinned[i] && v < min);
		if (under < 0) break;
		pinned[under] = true;
	}
	// Whole pixels, with the rounding error given to the last.
	const rounded = out.map(Math.floor);
	rounded[n - 1] += total - rounded.reduce((s, v) => s + v, 0);
	return rounded;
}

/**
 * Move weight across one gap so the two neighbours are `aPx` and `bPx`
 * wide (or tall). Their total weight stays the same, so nothing else moves.
 */
function splitWeights(a, b, aPx, bPx) {
	const total = a + b;
	const share = aPx / (aPx + bPx);
	return [total * share, total * (1 - share)];
}

/**
 * Drag the gap after visible column `col` by `dx` px.
 *
 * @param {Array} columns the full layout (hidden widgets included).
 * @param {Array} visible the visible layout the drag started from.
 * @param {{w: number}[]} boxes px widths of the visible columns at the start.
 */
export function resizeColumn(columns, visible, boxes, col, dx, minWidth = LAYOUT_DEFAULTS.minWidth) {
	const a = boxes[col].w;
	const b = boxes[col + 1].w;
	const move = Math.max(minWidth - a, Math.min(dx, b - minWidth));
	const [wa, wb] = splitWeights(visible[col].w, visible[col + 1].w, a + move, b - move);
	const out = clone(columns);
	const target = (vis) => out.find((c) => c.items.some((item) => item.id === vis.items[0].id));
	target(visible[col]).w = wa;
	target(visible[col + 1]).w = wb;
	return out;
}

/**
 * Drag the gap below visible widget `aboveId` (and above `belowId`) by
 * `dy` px, given their px heights at the start.
 */
export function resizeRow(columns, aboveId, belowId, aPx, bPx, dy, minHeight = LAYOUT_DEFAULTS.minHeight) {
	const move = Math.max(minHeight - aPx, Math.min(dy, bPx - minHeight));
	const out = clone(columns);
	const above = out.flatMap((c) => c.items).find((item) => item.id === aboveId);
	const below = out.flatMap((c) => c.items).find((item) => item.id === belowId);
	[above.h, below.h] = splitWeights(above.h, below.h, aPx + move, bPx - move);
	return out;
}

/**
 * Move a widget. `to` is either a place in an existing column — before
 * the visible widget `before` (or at the end with null) of the column
 * holding visible widget `inColumnOf` — or a new column at visible column
 * position `newColumn`.
 *
 * @param {Array} columns the full layout.
 * @param {string} id
 * @param {{inColumnOf: string, before: string | null} | {newColumn: number, visible: Array}} to
 */
export function moveWidget(columns, id, to) {
	let out = clone(columns);
	let moving = null;
	for (const col of out) {
		const i = col.items.findIndex((item) => item.id === id);
		if (i >= 0) [moving] = col.items.splice(i, 1);
	}
	if (!moving) return columns;

	if ("newColumn" in to) {
		// Insert before the full-layout column holding the visible column at
		// that position (or at the end), as wide as an average column.
		const anchor = to.visible[to.newColumn]?.items.find((item) => item.id !== id)?.id;
		let at = anchor ? out.findIndex((col) => col.items.some((item) => item.id === anchor)) : out.length;
		if (at < 0) at = out.length;
		const avg = out.reduce((s, col) => s + col.w, 0) / Math.max(1, out.filter((c) => c.items.length).length);
		out.splice(at, 0, { w: avg || 1, items: [{ ...moving, h: 1 }] });
	} else {
		const col = out.find((c) => c.items.some((item) => item.id === to.inColumnOf));
		if (!col) return columns;
		const at = to.before ? col.items.findIndex((item) => item.id === to.before) : col.items.length;
		col.items.splice(at < 0 ? col.items.length : at, 0, moving);
	}
	out = out.filter((col) => col.items.length);
	return out;
}

/** Trade two widgets' places (each takes the other's size too). */
export function swapWidgets(columns, a, b) {
	const out = clone(columns);
	for (const col of out) {
		for (const item of col.items) {
			if (item.id === a) item.id = b;
			else if (item.id === b) item.id = a;
		}
	}
	return out;
}

/**
 * Where a widget held at `point` would land, judged against the boxes
 * on screen now (the dragged widget's own excluded).
 *
 * Near the left or right edge of the board, or in a gap between columns,
 * it starts a new column there. Otherwise it goes into the column under
 * the pointer, before the first widget whose middle is below the pointer.
 *
 * @param {{x: number, y: number}} point px, relative to the board.
 * @param {ReturnType<typeof computeRects>} layout
 * @param {Array} visible the visible layout those boxes were computed from.
 * @param {string} id the widget being dragged.
 * @param {{width: number, edge?: number, gap?: number}} board
 */
export function dropTarget(point, layout, visible, id, { width, edge = 40, gap = LAYOUT_DEFAULTS.gap }) {
	const cols = layout.columns;
	const alone = (c) => visible[c].items.length === 1 && visible[c].items[0].id === id;
	if (point.x < edge && !alone(0)) return { newColumn: 0, visible };
	if (point.x > width - edge && !alone(cols.length - 1)) return { newColumn: cols.length, visible };
	for (let c = 1; c < cols.length; c += 1) {
		const gapStart = cols[c].x - gap;
		if (point.x >= gapStart - 8 && point.x <= cols[c].x + 8 && !alone(c) && !alone(c - 1)) {
			return { newColumn: c, visible };
		}
	}
	let c = cols.findIndex((col) => point.x < col.x + col.w + gap / 2);
	if (c < 0) c = cols.length - 1;
	const others = visible[c].items.filter((item) => item.id !== id);
	if (!others.length) return null; // already alone in this column: stay
	const before = others.find((item) => {
		const r = layout.rects[item.id];
		return point.y < r.y + r.h / 2;
	});
	return { inColumnOf: others[0].id, before: before ? before.id : null };
}

/**
 * Where a widget held at `point` lands when the columns are stacked into
 * one list: before the first widget whose middle is below the pointer, in
 * that widget's column; past the last, at the end of the last column.
 */
export function stackedDropTarget(point, layout, visible, id) {
	const order = visible.flatMap((col) => col.items).filter((item) => item.id !== id);
	if (!order.length) return null;
	const before = order.find((item) => {
		const r = layout.rects[item.id];
		return point.y < r.y + r.h / 2;
	});
	if (before) return { inColumnOf: before.id, before: before.id };
	return { inColumnOf: order[order.length - 1].id, before: null };
}
