// Shared utility helpers used across dashboard widgets.

export const pad = (n) => String(n).padStart(2, "0");

export function timeAgo(iso) {
	const ms = Date.now() - new Date(iso).getTime();
	const m = Math.round(ms / 60000);
	if (m < 1) return "just now";
	if (m < 60) return `${m}m ago`;
	const h = Math.round(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.round(h / 24);
	return `${d}d ago`;
}

/**
 * Hide list items that don't fully fit inside their container so partial
 * rows aren't shown. Re-runs on layout changes (resize, content swap).
 */
export function trimListToFit(listEl) {
	if (!listEl) return;
	const items = Array.from(listEl.children);
	items.forEach((item) => { item.style.display = ""; });
	// Force a reflow so getBoundingClientRect reflects the freshly-revealed items.
	void listEl.offsetHeight;
	const listBottom = listEl.getBoundingClientRect().bottom;
	items.forEach((item) => {
		const rect = item.getBoundingClientRect();
		if (rect.bottom > listBottom + 1) item.style.display = "none";
	});
}
