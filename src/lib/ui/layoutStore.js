// The non-reactive half of drag-to-rearrange: reading, validating and writing
// a saved panel order. Kept as plain JS (rather than living inside
// reorder.svelte.js) so it can be tested without compiling runes — this is
// where the interesting failure cases are.

/** The stored ids the page still has panels for, in the order they were saved. */
function keepKnown(stored, defaults) {
	const known = new Set(defaults);
	return [...new Set(stored.filter((id) => known.has(id)))];
}

/**
 * Put back whatever the stored layout didn't account for, each at the position
 * it holds by default. A panel added since the layout was saved therefore turns
 * up where the page meant it to be, and everything already arranged keeps its
 * order around it.
 */
function withMissing(layout, defaults) {
	const filled = [...layout];
	for (const [idx, id] of defaults.entries()) {
		if (!filled.includes(id)) {
			filled.splice(Math.min(idx, filled.length), 0, id);
		}
	}
	return filled;
}

/**
 * Reconcile a stored layout with the panels the page has today.
 *
 * Anything that can't be trusted is discarded rather than rendered: a duplicate
 * would draw one panel twice, an unknown id would draw a hole. What is trusted
 * is the order — so adding or removing a panel costs the reader the position of
 * that one panel, not the arrangement they made.
 *
 * @param {unknown} stored parsed value from storage.
 * @param {string[]} defaults the page's default order.
 * @returns {string[] | null} a full layout, or null if there was nothing to
 *   read at all.
 */
function validateLayout(stored, defaults) {
	if (!Array.isArray(stored)) {
		return null;
	}
	return withMissing(keepKnown(stored, defaults), defaults);
}

/**
 * Reads and validates the layout saved under `key`. Storage can throw
 * outright (Safari private browsing) and can hold anything at all, so every
 * failure is the same failure: no usable layout.
 *
 * @returns {string[] | null}
 */
function readLayout(key, defaults) {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) {
			return null;
		}
		return validateLayout(JSON.parse(raw), defaults);
	} catch (error) {
		return null;
	}
}

/** Best-effort persist; a full or unavailable store just means no memory. */
function writeLayout(key, layout) {
	try {
		localStorage.setItem(key, JSON.stringify(layout));
		return true;
	} catch (error) {
		return false;
	}
}

function isSlot(layout, idx) {
	return Number.isInteger(idx) && idx >= 0 && idx < layout.length;
}

function canSwap(layout, srcIdx, dstIdx) {
	return srcIdx !== dstIdx && isSlot(layout, srcIdx) && isSlot(layout, dstIdx);
}

/**
 * Swaps two slots. Out-of-range or no-op swaps return the layout unchanged
 * (identity included) so callers can treat a drag dropped on itself as
 * "nothing happened".
 *
 * @param {string[]} layout
 * @param {number} srcIdx
 * @param {number} dstIdx
 * @returns {string[]}
 */
function swapSlots(layout, srcIdx, dstIdx) {
	if (!canSwap(layout, srcIdx, dstIdx)) {
		return layout;
	}
	const src = layout.at(srcIdx);
	const dst = layout.at(dstIdx);
	return layout.map((id, idx) => {
		if (idx === srcIdx) {
			return dst;
		}
		if (idx === dstIdx) {
			return src;
		}
		return id;
	});
}

export { validateLayout, readLayout, writeLayout, swapSlots };
