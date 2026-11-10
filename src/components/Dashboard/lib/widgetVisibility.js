// Which dashboard widgets are showing.
//
// Only the choices someone has actually made are stored, as {id: boolean}.
// Anything they haven't touched falls back to the widget's own default, so a
// widget added later turns up (or stays tucked away) as its registry entry
// says, rather than as an old saved list happens to imply.
//
// Kept apart from the saved order (lib/ui/layoutStore, shared with /running):
// a hidden widget keeps its place in that order, so showing it again puts
// it back where it was.

/** True if the widget should render under these choices. */
export function isShown(choices, widget) {
	const choice = choices[widget.id];
	return typeof choice === "boolean" ? choice : widget.defaultShown !== false;
}

/** A copy of `choices` with one widget switched on or off. */
export function setShown(choices, id, shown) {
	return { ...choices, [id]: shown };
}

/** Keep only well-formed entries: a known id mapped to a boolean. */
export function validateVisibility(stored, knownIds) {
	if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
		return {};
	}
	const known = new Set(knownIds);
	return Object.fromEntries(
		Object.entries(stored).filter(([id, shown]) => known.has(id) && typeof shown === "boolean"),
	);
}

/** Storage can throw or hold anything; every failure means "no choices". */
export function readVisibility(key, knownIds) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? validateVisibility(JSON.parse(raw), knownIds) : {};
	} catch {
		return {};
	}
}

export function writeVisibility(key, choices) {
	try {
		localStorage.setItem(key, JSON.stringify(choices));
		return true;
	} catch {
		return false;
	}
}

export function clearVisibility(key) {
	try {
		localStorage.removeItem(key);
	} catch {
		// Nothing stored, or nowhere to store it: either way, nothing to clear.
	}
}
