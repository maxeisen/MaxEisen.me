// The non-reactive half of drag-to-rearrange: reading, validating and writing
// a saved panel order. Kept as plain JS (rather than living inside
// reorder.svelte.js) so it can be tested without compiling runes — this is
// where the interesting failure cases are.

/**
 * A stored layout is only usable if it is still a permutation of the panels
 * the page has today. A renamed panel, a truncated write, or a layout saved by
 * an older version of the page all fail this and fall back to the default,
 * which is much better than rendering a grid with holes or duplicates in it.
 *
 * @param {unknown} stored parsed value from storage.
 * @param {string[]} defaults the page's default order.
 * @returns {string[] | null} the layout, or null if it can't be trusted.
 */
export function validateLayout(stored, defaults) {
	if (!Array.isArray(stored)) return null;
	if (stored.length !== defaults.length) return null;
	if (new Set(stored).size !== stored.length) return null;
	if (!stored.every((id) => defaults.includes(id))) return null;
	return [...stored];
}

/**
 * Reads and validates the layout saved under `key`. Storage can throw
 * outright (Safari private browsing) and can hold anything at all, so every
 * failure is the same failure: no usable layout.
 *
 * @returns {string[] | null}
 */
export function readLayout(key, defaults) {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return validateLayout(JSON.parse(raw), defaults);
	} catch {
		return null;
	}
}

/** Best-effort persist; a full or unavailable store just means no memory. */
export function writeLayout(key, layout) {
	try {
		localStorage.setItem(key, JSON.stringify(layout));
		return true;
	} catch {
		return false;
	}
}

/**
 * Swaps two slots. Out-of-range or no-op swaps return the layout unchanged so
 * callers can treat a dropped-on-itself drag as "nothing happened".
 *
 * @param {string[]} layout
 * @param {number} srcIdx
 * @param {number} dstIdx
 * @returns {string[]}
 */
export function swapSlots(layout, srcIdx, dstIdx) {
	if (!Number.isInteger(srcIdx) || !Number.isInteger(dstIdx)) return layout;
	if (srcIdx === dstIdx) return layout;
	if (srcIdx < 0 || dstIdx < 0) return layout;
	if (srcIdx >= layout.length || dstIdx >= layout.length) return layout;
	const next = [...layout];
	[next[srcIdx], next[dstIdx]] = [next[dstIdx], next[srcIdx]];
	return next;
}
