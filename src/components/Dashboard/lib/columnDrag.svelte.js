// Dragging on the dashboard: moving widgets between and within columns, and
// dragging the gaps between them to resize (lib/columnLayout).
//
// Moving: while a widget is dragged, the layout a drop would give is
// previewed live — the others make room, a placeholder marks the landing
// spot — so the drop holds no surprises. Escape puts everything back.
//
// Resizing: dragging a gap moves size from one neighbour to the other, live,
// so a widget's content changes as you go and you can stop when it shows
// what you want. It's saved when you let go; Escape puts it back.
//
// It has the same surface as lib/ui/reorder where lib/ui/editMode touches
// it (`enabled`, `suppressesClick`); editMode takes it as `createDrag`.
// The lessons recorded in lib/ui/reorder hold here too: no pointer capture
// (it breaks links inside a tile), and nothing changes until the pointer
// has moved past the threshold (so a plain click still clicks).

/* global $state -- a compiler intrinsic, not an import. */

import {
	defaultLayout, validateLayout, moveWidget, swapWidgets, resizeColumn, resizeRow,
	dropTarget, stackedDropTarget,
} from "./columnLayout.js";

const CLICK_SUPPRESSION_MS = 300;

function readColumns(key, ids) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? validateLayout(JSON.parse(raw), ids) : null;
	} catch {
		return null;
	}
}

function writeColumns(key, columns) {
	try {
		localStorage.setItem(key, JSON.stringify({ columns }));
	} catch {
		// Private browsing or full storage: the layout lasts this visit only.
	}
}

/**
 * @param {object} options
 * @param {string[]} options.order every widget id.
 * @param {string} options.storageKey localStorage key for the saved layout.
 * @param {() => {visible: Array, layout: object, board: HTMLElement}}
 *   options.measure the page's current visible layout, its computed boxes
 *   (lib/columnLayout computeRects) and the board element they're relative to.
 * @param {number} [options.threshold] px of movement before a press drags.
 * @param {() => boolean} [options.enabled] gate, e.g. "only in edit mode".
 */
export function createColumnDrag({
	order,
	storageKey,
	measure,
	threshold = 5,
	enabled = () => true,
}) {
	const ids = [...order];
	// Read at construction, before the first render, so the default layout
	// never flashes first.
	let columns = $state(readColumns(storageKey, ids) ?? defaultLayout(ids));
	let draggingId = $state(null);
	let preview = $state(null); // full layout a drop here would give
	let origin = $state(null); // the dragged widget's box at the start
	let offset = $state(null); // {x, y} px the pointer has moved
	let resizing = $state(null); // the handle being dragged
	let suppressClickUntil = 0;

	function save(next) {
		columns = next;
		writeColumns(storageKey, columns);
	}

	const isPrimaryButton = (event) => typeof event.button !== "number" || event.button === 0;

	/** Follow one pointer until it lifts; `onDrag` runs once it's past the threshold. */
	function track(event, { onBegin, onDrag, onEnd }) {
		const pointerId = event.pointerId;
		const startX = event.clientX;
		const startY = event.clientY;
		let started = false;

		const finish = (commit) => {
			detach();
			if (started) {
				onEnd(commit);
				suppressClickUntil = Date.now() + CLICK_SUPPRESSION_MS;
			}
		};
		const onMove = (ev) => {
			if (ev.pointerId !== pointerId) return;
			const dx = ev.clientX - startX;
			const dy = ev.clientY - startY;
			if (!started) {
				if (Math.hypot(dx, dy) < threshold) return;
				started = onBegin() !== false;
				if (!started) {
					detach();
					return;
				}
			}
			ev.preventDefault();
			onDrag(dx, dy, ev);
		};
		const onUp = (ev) => { if (ev.pointerId === pointerId) finish(true); };
		const onCancel = (ev) => { if (ev.pointerId === pointerId) finish(false); };
		const onKey = (ev) => {
			if (ev.key === "Escape" && started) {
				ev.preventDefault();
				finish(false);
			}
		};
		function detach() {
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
			document.removeEventListener("pointercancel", onCancel);
			document.removeEventListener("keydown", onKey);
		}
		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onUp);
		document.addEventListener("pointercancel", onCancel);
		document.addEventListener("keydown", onKey);
	}

	/** Pick a widget up. */
	function start(id, event) {
		if (!isPrimaryButton(event) || draggingId !== null || resizing || !enabled()) return;
		let grab = null;

		track(event, {
			onBegin: () => {
				const { layout, board } = measure();
				const box = layout.rects[id];
				if (!box) return false;
				const rect = board.getBoundingClientRect();
				// Where in the tile it was picked up, so the tile's middle (not
				// the pointer) is what's matched to a place.
				grab = { x: event.clientX - (rect.left + box.x), y: event.clientY - (rect.top + box.y), w: box.w, h: box.h };
				origin = { ...box };
				preview = columns;
				draggingId = id;
				return true;
			},
			onDrag: (dx, dy, ev) => {
				offset = { x: dx, y: dy };
				const { layout, visible, board } = measure();
				const rect = board.getBoundingClientRect();
				const point = {
					x: ev.clientX - rect.left - grab.x + grab.w / 2,
					y: ev.clientY - rect.top - grab.y + Math.min(grab.h / 2, 60),
				};
				const target = layout.stacked
					? stackedDropTarget(point, layout, visible, id)
					: dropTarget(point, layout, visible, id, { width: rect.width });
				if (!target) return;
				const next = moveWidget(preview, id, target);
				if (JSON.stringify(next) !== JSON.stringify(preview)) preview = next;
			},
			onEnd: (commit) => {
				if (commit && JSON.stringify(preview) !== JSON.stringify(columns)) save(preview);
				draggingId = null;
				preview = null;
				origin = null;
				offset = null;
			},
		});
	}

	/** Drag the gap described by `handle` (from computeRects). */
	function startResize(handle, event) {
		if (!isPrimaryButton(event) || draggingId !== null || resizing || !enabled()) return;
		event.stopPropagation();
		let before = null;
		let snapshot = null;
		track(event, {
			onBegin: () => {
				before = columns;
				snapshot = measure();
				resizing = handle;
				return true;
			},
			onDrag: (dx, dy) => {
				const { visible, layout } = snapshot;
				if (handle.kind === "col") {
					columns = resizeColumn(before, visible, layout.columns, handle.col, dx);
				} else {
					const items = visible[handle.col].items;
					const above = items[handle.index].id;
					const below = items[handle.index + 1].id;
					columns = resizeRow(before, above, below, layout.rects[above].h, layout.rects[below].h, dy);
				}
			},
			onEnd: (commit) => {
				if (commit) save(columns);
				else columns = before;
				resizing = null;
			},
		});
	}

	return {
		/** What to draw: the drop preview while dragging, else the layout. */
		get shown() { return preview ?? columns; },
		get draggingId() { return draggingId; },
		get isDragging() { return draggingId !== null; },
		get resizing() { return resizing; },
		/** Where the dragged widget sat when the drag began. */
		get origin() { return origin; },

		/** Inline transform for the dragged tile, or null at rest. */
		transformFor(id, { scale = 1.02 } = {}) {
			if (draggingId !== id || !offset) return null;
			return `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
		},

		/** True for the moment after a drag, when the click is drag residue. */
		suppressesClick() {
			return Date.now() < suppressClickUntil;
		},

		start,
		startResize,

		reset() {
			save(defaultLayout(ids));
		},

		/** Move a gap by `delta` px at once (keyboard), and save. */
		nudge(handle, delta) {
			if (draggingId !== null || resizing) return;
			const { visible, layout } = measure();
			if (handle.kind === "col") {
				save(resizeColumn(columns, visible, layout.columns, handle.col, delta));
			} else {
				const items = visible[handle.col].items;
				const above = items[handle.index].id;
				const below = items[handle.index + 1].id;
				save(resizeRow(columns, above, below, layout.rects[above].h, layout.rects[below].h, delta));
			}
		},

		/** Trade two widgets' places, sizes included. */
		swap(a, b) {
			save(swapWidgets(columns, a, b));
		},
	};
}
