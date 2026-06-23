import { trimListToFit } from "./utils.js";

/**
 * Debounced "trim rows on resize" binder for list widgets.
 *
 * Returns a cleanup function that clears pending timers and removes the resize
 * listener.
 */
export function bindTrimOnResize(
	listEl,
	{
		debounceMs = 100,
		windowObj = typeof window === "undefined" ? null : window,
		trim = trimListToFit,
	} = {},
) {
	if (!windowObj?.addEventListener || !windowObj?.removeEventListener) return () => {};

	let resizeTimer;
	const onResize = () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => trim(listEl), debounceMs);
	};

	windowObj.addEventListener("resize", onResize);

	return () => {
		clearTimeout(resizeTimer);
		windowObj.removeEventListener("resize", onResize);
	};
}
