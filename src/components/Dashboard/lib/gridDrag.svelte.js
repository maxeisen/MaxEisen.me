// Drag-to-rearrange for the dashboard's packed grid.
//
// /running's panels use lib/ui/reorder: fixed slots, and a drop swaps two
// of them. That suits slots of one size. Here widgets come in different
// sizes and the grid packs them, so a swap sends both widgets (and often
// everything after them) somewhere other than where you let go. Instead,
// while a widget is dragged, lib/gridReorder works out the order that lands
// it nearest the cell it's held over and the page previews that layout live
// — the other widgets make room, a placeholder marks the landing spot — so
// the drop holds no surprises. Escape puts everything back.
//
// It has the same surface as lib/ui/reorder where lib/ui/editMode touches
// it (`enabled`, `suppressesClick`), so edit mode's rules for when dragging
// is allowed apply unchanged; editMode takes it as `createDrag`.
//
// The two lessons recorded in lib/ui/reorder hold here too: no pointer
// capture (it breaks links inside a tile), and nothing changes until the
// pointer has moved past the threshold (so a plain click still clicks).

/* global $state -- a compiler intrinsic, not an import. */

import { readLayout, writeLayout } from "../../../lib/ui/layoutStore.js";
import { bestDrop, cellAt, mergeOrder } from "./gridReorder.js";

const CLICK_SUPPRESSION_MS = 300;

/**
 * @param {object} options
 * @param {string[]} options.order default widget ids, in order.
 * @param {string} options.storageKey localStorage key for the saved order.
 * @param {() => {items: {id: string, w: number, h: number}[], cols: number,
 *   placements: Record<string, object>, grid: HTMLElement, rowPitch: number,
 *   colPitch: number}} options.measure the page's current grid: visible
 *   widgets in order, column count, placements, the grid element, and the
 *   distance between track starts in px. Read when a drag starts.
 * @param {number} [options.threshold] px of movement before a press drags.
 * @param {() => boolean} [options.enabled] gate, e.g. "only in edit mode".
 */
export function createGridDrag({
	order,
	storageKey,
	measure,
	threshold = 5,
	enabled = () => true,
}) {
	const defaults = [...order];

	let layout = $state([...defaults]);
	let draggingId = $state(null);
	let preview = $state(null); // visible ids in their previewed order
	let origin = $state(null); // the dragged widget's placement at the start
	let offset = $state(null); // {x, y} px the pointer has moved
	let suppressClickUntil = 0;

	function restore() {
		const stored = readLayout(storageKey, defaults);
		if (stored) layout = stored;
	}

	function save(next) {
		layout = next;
		writeLayout(storageKey, layout);
	}

	function isPrimaryButton(event) {
		return typeof event.button !== "number" || event.button === 0;
	}

	function start(id, event) {
		if (!isPrimaryButton(event) || draggingId !== null || !enabled()) return;

		const pointerId = event.pointerId;
		const startX = event.clientX;
		const startY = event.clientY;
		let snapshot = null;
		let grab = null;

		// Measured when the press becomes a drag, not at pointerdown: a plain
		// click shouldn't pay for it.
		const begin = () => {
			snapshot = measure();
			const placement = snapshot.placements[id];
			if (!placement) return false;
			const rect = snapshot.grid.getBoundingClientRect();
			// Where in the tile it was picked up, so the tile's top-left (not
			// the pointer) is what gets matched to a cell.
			grab = {
				x: startX - (rect.left + placement.x * snapshot.colPitch),
				y: startY - (rect.top + placement.y * snapshot.rowPitch),
			};
			origin = { ...placement };
			preview = snapshot.items.map((item) => item.id);
			draggingId = id;
			return true;
		};

		const updatePreview = (x, y) => {
			const rect = snapshot.grid.getBoundingClientRect();
			const target = cellAt(
				{
					x: x - grab.x + snapshot.colPitch / 2,
					y: y - grab.y + snapshot.rowPitch / 2,
				},
				{ left: rect.left, top: rect.top, colPitch: snapshot.colPitch, rowPitch: snapshot.rowPitch },
			);
			const { order: next } = bestDrop({ items: snapshot.items, id, target, cols: snapshot.cols });
			if (next.join() !== preview.join()) preview = next;
		};

		const finish = (commit) => {
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
			document.removeEventListener("pointercancel", onCancel);
			document.removeEventListener("keydown", onKey);
			if (draggingId !== null) {
				const visible = snapshot.items.map((item) => item.id);
				if (commit && preview.join() !== visible.join()) {
					save(mergeOrder(layout, preview));
				}
				suppressClickUntil = Date.now() + CLICK_SUPPRESSION_MS;
			}
			draggingId = null;
			preview = null;
			origin = null;
			offset = null;
		};

		const onMove = (ev) => {
			if (ev.pointerId !== pointerId) return;
			if (draggingId === null) {
				if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < threshold) return;
				if (!begin()) {
					finish(false);
					return;
				}
			}
			ev.preventDefault();
			offset = { x: ev.clientX - startX, y: ev.clientY - startY };
			updatePreview(ev.clientX, ev.clientY);
		};
		const onUp = (ev) => {
			if (ev.pointerId === pointerId) finish(true);
		};
		const onCancel = (ev) => {
			if (ev.pointerId === pointerId) finish(false);
		};
		const onKey = (ev) => {
			if (ev.key === "Escape" && draggingId !== null) {
				ev.preventDefault();
				finish(false);
			}
		};

		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onUp);
		document.addEventListener("pointercancel", onCancel);
		document.addEventListener("keydown", onKey);
	}

	return {
		/** Every widget id, in saved order (hidden ones included). */
		get layout() { return layout; },
		get draggingId() { return draggingId; },
		get isDragging() { return draggingId !== null; },
		/** Visible ids in the order a drop here would give, while dragging. */
		get preview() { return preview; },
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

		restore,
		start,

		reset() {
			save([...defaults]);
		},

		/** Trade two widgets' places in the saved order. */
		swap(a, b) {
			const ia = layout.indexOf(a);
			const ib = layout.indexOf(b);
			if (ia < 0 || ib < 0 || ia === ib) return;
			const next = [...layout];
			next[ia] = b;
			next[ib] = a;
			save(next);
		},
	};
}
