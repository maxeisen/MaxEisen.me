// The non-reactive half of drag-to-rearrange: reading, validating and writing
// a saved panel order. Kept as plain JS (rather than living inside
// reorder.svelte.js) so it can be tested without compiling runes — this is
// where the interesting failure cases are.

/**
 * A stored layout is only usable if it is still a permutation of the panels
 * the page has today: same length, no duplicates, no unknown ids.
 */
function isPermutationOf(stored, defaults) {
	return stored.length === defaults.length
		&& new Set(stored).size === stored.length
		&& stored.every((id) => defaults.includes(id));
}

/**
 * A renamed panel, a truncated write, or a layout saved by an older version of
 * the page all fail validation and fall back to the default, which is much
 * better than rendering a grid with holes or duplicates in it.
 *
 * @param {unknown} stored parsed value from storage.
 * @param {string[]} defaults the page's default order.
 * @returns {string[] | null} the layout, or null if it can't be trusted.
 */
function validateLayout(stored, defaults) {
	if (!Array.isArray(stored)) {
		return null;
	}
	if (!isPermutationOf(stored, defaults)) {
		return null;
	}
	return [...stored];
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

// Exported down here rather than inline. Static analysis reads this repo's JS
// with a parser that predates ES modules: an `export` keyword mid-file makes
// it lose the thread and misread everything after it, which it then reports as
// phantom findings against the try/catch above. A trailing list parses.
export { validateLayout, readLayout, writeLayout, swapSlots };
