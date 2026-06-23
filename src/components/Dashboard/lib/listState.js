/**
 * Normalize widget list loading state for template conditionals.
 *
 * Convention used in dashboard widgets:
 * - `null` means "loading"
 * - `[]` means "loaded but empty/unavailable"
 * - non-empty arrays mean "ready"
 */
export function listLoadState(items) {
	if (items === null) return "loading";
	if (Array.isArray(items) && items.length === 0) return "empty";
	return "ready";
}

/**
 * Map a normalized list state to a display message.
 *
 * @param {"loading" | "empty" | "ready"} state
 * @param {string} loadingText
 * @param {string} emptyText
 * @returns {string | null}
 */
export function listStateMessage(state, loadingText, emptyText) {
	if (state === "loading") return loadingText;
	if (state === "empty") return emptyText;
	return null;
}
