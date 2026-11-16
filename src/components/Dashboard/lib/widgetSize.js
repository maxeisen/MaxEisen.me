// How big each dashboard widget is.
//
// Every widget offers up to three sizes in the registry (`sizes`, keyed
// "s", "m", "l") and names one as its `defaultSize`. Only the sizes someone
// has picked are stored, as {id: key}. A widget nobody has sized uses its
// default and may be grown into gaps in the grid; a widget someone has
// sized keeps exactly that size (`fixed`), because they chose how much of
// it they want to see.

export const SIZE_KEYS = ["s", "m", "l"];
export const SIZE_LABELS = { s: "Small", m: "Medium", l: "Large" };

/** The size keys this widget offers, smallest first. */
export function sizeKeys(widget) {
	return SIZE_KEYS.filter((key) => widget.sizes?.[key]);
}

/**
 * The widget's size under these choices: its key, its {w, h} in grid units,
 * and whether it's `fixed` (picked by someone, so the grid mustn't grow it).
 */
export function sizeOf(choices, widget) {
	const chosen = choices[widget.id];
	if (chosen && widget.sizes?.[chosen]) {
		return { key: chosen, ...widget.sizes[chosen], fixed: true };
	}
	return { key: widget.defaultSize, ...widget.sizes[widget.defaultSize], fixed: false };
}

/** A copy of `choices` with one widget's size recorded. */
export function setSize(choices, id, key) {
	return { ...choices, [id]: key };
}

/** Keep only well-formed entries: a known widget mapped to a size it offers. */
export function validateSizes(stored, widgets) {
	if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
		return {};
	}
	const byId = Object.fromEntries(widgets.map((w) => [w.id, w]));
	return Object.fromEntries(
		Object.entries(stored).filter(
			([id, key]) => typeof key === "string" && Boolean(byId[id]?.sizes?.[key]),
		),
	);
}

/** Storage can throw or hold anything; every failure means "no choices". */
export function readSizes(key, widgets) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? validateSizes(JSON.parse(raw), widgets) : {};
	} catch {
		return {};
	}
}

export function writeSizes(key, choices) {
	try {
		localStorage.setItem(key, JSON.stringify(choices));
		return true;
	} catch {
		return false;
	}
}

export function clearSizes(key) {
	try {
		localStorage.removeItem(key);
	} catch {
		// Nothing stored, or nowhere to store it: either way, nothing to clear.
	}
}
