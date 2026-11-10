import { trimListToFit } from "./utils.js";

/**
 * Re-trim a list widget whenever the list itself changes size.
 *
 * Watches the element rather than the window: on the dashboard a widget's
 * box changes for reasons the window never hears about — a drag that swaps
 * two widgets, another widget being hidden, the grid picking a new column
 * count. The trim is deferred a frame so it runs once per burst of changes,
 * and outside the observer callback (it changes what's displayed, which
 * would otherwise risk a ResizeObserver loop).
 *
 * Returns a cleanup that disconnects the observer and drops any pending trim.
 */
export function bindTrimOnResize(
	listEl,
	{
		trim = trimListToFit,
		Observer = typeof ResizeObserver === "undefined" ? null : ResizeObserver,
		schedule = (fn) => requestAnimationFrame(fn),
		cancel = (id) => cancelAnimationFrame(id),
	} = {},
) {
	if (!listEl || !Observer) return () => {};

	let pending = null;
	const observer = new Observer(() => {
		if (pending !== null) return;
		pending = schedule(() => {
			pending = null;
			trim(listEl);
		});
	});
	observer.observe(listEl);

	return () => {
		observer.disconnect();
		if (pending !== null) cancel(pending);
		pending = null;
	};
}
