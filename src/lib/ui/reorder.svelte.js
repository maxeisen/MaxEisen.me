// Drag-to-rearrange for a grid of fixed slots.
//
// Extracted from /dashboard, which had all of this inline, when /training
// wanted the same behaviour. The model is deliberately slots-not-lists: the
// positions are fixed and sized by the page, and a drop swaps whichever two
// panels are involved. Nothing reflows mid-drag, so the thing under your
// finger stays under your finger — which is the whole reason this doesn't use
// an insert-and-shift list.
//
// Two details here are load-bearing and were both learned the hard way:
//
//   - No setPointerCapture. Capturing redirects the synthesized click to the
//     dragged element instead of the anchor inside it, which breaks every link
//     in a panel.
//   - draggingId is not set until the pointer crosses the threshold. The
//     dragging class carries `pointer-events: none` (so elementFromPoint can
//     find the slot underneath), and turning that on at pointerdown means a
//     plain press dispatches its click to the slot rather than to whatever was
//     pressed — nothing inside a panel would be clickable at all.

// $state is a Svelte compiler intrinsic rather than an import, so tell plain-JS
// linters about it.
/* global $state */

import { readLayout, writeLayout, swapSlots } from "./layoutStore.js";

const CLICK_SUPPRESSION_MS = 300;

/**
 * @param {object} options
 * @param {string[]} options.order default panel ids, in slot order.
 * @param {string} options.storageKey localStorage key for the saved layout.
 * @param {string} [options.slotSelector] identifies a drop target; the
 *   element must carry `data-slot-index`.
 * @param {number} [options.threshold] px of movement before a press becomes
 *   a drag.
 * @param {() => boolean} [options.enabled] gate, e.g. "only in edit mode".
 * @param {() => void} [options.onReorder] side effects after a swap lands.
 */
function createReorder({
	order,
	storageKey,
	slotSelector = ".slot[data-slot-index]",
	threshold = 5,
	enabled = () => true,
	onReorder = () => {},
}) {
	const defaults = [...order];

	let layout = $state([...defaults]);
	let draggingId = $state(null);
	let dropTargetIdx = $state(null);
	let dragTransform = $state(null);
	let isDragging = $state(false);
	let suppressClickUntil = 0;

	function restore() {
		const stored = readLayout(storageKey, defaults);
		if (!stored) {
			return false;
		}
		layout = stored;
		return true;
	}

	function swap(srcIdx, dstIdx) {
		const next = swapSlots(layout, srcIdx, dstIdx);
		if (next === layout) {
			return;
		}
		layout = next;
		writeLayout(storageKey, layout);
		onReorder();
	}

	// Left button only. Synthetic events, and pointer events for touch on some
	// engines, leave `button` unset; that counts as primary.
	function isPrimaryButton(event) {
		return typeof event.button !== "number" || event.button === 0;
	}

	function canStart(event) {
		return isPrimaryButton(event) && draggingId === null && enabled();
	}

	// `.dragging` sets pointer-events: none, so this looks straight through the
	// panel being dragged to the slot underneath the pointer.
	function slotUnder(x, y) {
		const el = document.elementFromPoint(x, y);
		return el ? el.closest(slotSelector) : null;
	}

	function slotIndexUnder(x, y) {
		const slot = slotUnder(x, y);
		const idx = slot ? Number(slot.dataset.slotIndex) : Number.NaN;
		return Number.isFinite(idx) ? idx : null;
	}

	function updateDropTarget(id, x, y) {
		const idx = slotIndexUnder(x, y);
		dropTargetIdx = idx === layout.indexOf(id) ? null : idx;
	}

	function clearDrag() {
		isDragging = false;
		draggingId = null;
		dropTargetIdx = null;
		dragTransform = null;
	}

	function start(id, event) {
		if (!canStart(event)) {
			return;
		}

		const pointerId = event.pointerId;
		const startX = event.clientX;
		const startY = event.clientY;
		let started = false;

		// A press only becomes a drag once it has travelled far enough; until
		// then the pointer still belongs to whatever is inside the panel.
		const begin = (ev) => {
			if (started) {
				return true;
			}
			if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < threshold) {
				return false;
			}
			started = true;
			draggingId = id;
			isDragging = true;
			return true;
		};

		const drop = () => {
			if (dropTargetIdx !== null) {
				swap(layout.indexOf(id), dropTargetIdx);
			}
			suppressClickUntil = Date.now() + CLICK_SUPPRESSION_MS;
		};

		const onMove = (ev) => {
			if (ev.pointerId !== pointerId) {
				return;
			}
			if (!begin(ev)) {
				return;
			}
			ev.preventDefault();
			dragTransform = { x: ev.clientX - startX, y: ev.clientY - startY };
			updateDropTarget(id, ev.clientX, ev.clientY);
		};

		const onEnd = (ev) => {
			if (ev.pointerId !== pointerId) {
				return;
			}
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onEnd);
			document.removeEventListener("pointercancel", onEnd);
			if (started) {
				drop();
			}
			clearDrag();
		};

		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onEnd);
		document.addEventListener("pointercancel", onEnd);
	}

	return {
		get layout() {
			return layout;
		},
		get draggingId() {
			return draggingId;
		},
		get dropTargetIdx() {
			return dropTargetIdx;
		},
		get isDragging() {
			return isDragging;
		},

		/** Inline transform for a panel mid-drag, or null when it's at rest. */
		transformFor(id, { scale = 1.02 } = {}) {
			if (draggingId !== id || !dragTransform) {
				return null;
			}
			return `translate(${dragTransform.x}px, ${dragTransform.y}px) scale(${scale})`;
		},

		/** True for the moment after a drag, when the click is drag residue. */
		suppressesClick() {
			return Date.now() < suppressClickUntil;
		},

		restore,
		start,

		/** Put a panel in a given slot, swapping with whatever is there. */
		move(id, targetIdx) {
			swap(layout.indexOf(id), targetIdx);
		},

		reset() {
			layout = [...defaults];
			writeLayout(storageKey, layout);
			onReorder();
		},
	};
}

// Exported here rather than inline, for the reason given in layoutStore.js.
export { createReorder };
