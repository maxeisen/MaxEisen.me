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
export function createReorder({
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
		if (!stored) return false;
		layout = stored;
		return true;
	}

	function swap(srcIdx, dstIdx) {
		const next = swapSlots(layout, srcIdx, dstIdx);
		if (next === layout) return;
		layout = next;
		writeLayout(storageKey, layout);
		onReorder();
	}

	function start(id, event) {
		if (event.button !== undefined && event.button !== 0) return;
		if (draggingId !== null) return;
		if (!enabled()) return;

		const pointerId = event.pointerId;
		const startX = event.clientX;
		const startY = event.clientY;
		let started = false;

		const onMove = (ev) => {
			if (ev.pointerId !== pointerId) return;
			const dx = ev.clientX - startX;
			const dy = ev.clientY - startY;
			if (!started) {
				if (Math.hypot(dx, dy) < threshold) return;
				started = true;
				draggingId = id;
				isDragging = true;
			}
			ev.preventDefault();
			dragTransform = { x: dx, y: dy };

			const under = document.elementFromPoint(ev.clientX, ev.clientY);
			const slot = under?.closest(slotSelector);
			const idx = slot ? Number(slot.dataset.slotIndex) : null;
			const srcIdx = layout.indexOf(id);
			dropTargetIdx = idx != null && Number.isFinite(idx) && idx !== srcIdx ? idx : null;
		};

		const onEnd = (ev) => {
			if (ev.pointerId !== pointerId) return;
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onEnd);
			document.removeEventListener("pointercancel", onEnd);
			if (started) {
				if (dropTargetIdx != null) swap(layout.indexOf(id), dropTargetIdx);
				suppressClickUntil = Date.now() + CLICK_SUPPRESSION_MS;
			}
			isDragging = false;
			draggingId = null;
			dropTargetIdx = null;
			dragTransform = null;
		};

		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onEnd);
		document.addEventListener("pointercancel", onEnd);
	}

	return {
		get layout() { return layout; },
		get draggingId() { return draggingId; },
		get dropTargetIdx() { return dropTargetIdx; },
		get isDragging() { return isDragging; },

		/** Inline transform for a panel mid-drag, or null when it's at rest. */
		transformFor(id, { scale = 1.02 } = {}) {
			if (draggingId !== id || !dragTransform) return null;
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
