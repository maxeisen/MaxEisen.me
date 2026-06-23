import { fetchJsonSwr } from "../../../lib/data/swrCache.js";
import { createPoller } from "../../../lib/data/poller.js";

/**
 * Shared SWR + polling wrapper for dashboard widgets.
 *
 * The widget provides:
 * - `apply(data)` to map response payload into component state
 * - optional `onError(err)` for widget-specific fallback handling
 *
 * This helper keeps lifecycle behavior consistent across widgets while letting
 * each widget keep its own rendering state.
 */
export function createSWRWidgetFeed({
	url,
	apply,
	onError,
	maxAgeMs = 60_000,
	pollMs = 1000 * 60 * 5,
	jitterMs = 15_000,
	fetcher = fetchJsonSwr,
	pollerFactory = createPoller,
}) {
	async function load() {
		try {
			const data = await fetcher(url, { maxAgeMs, onRevalidate: apply });
			apply(data);
		} catch (err) {
			onError?.(err);
		}
	}

	function start() {
		// Fire-and-forget immediate refresh; callers do not await mount hooks.
		load();
		return pollerFactory(load, pollMs, { jitterMs });
	}

	return { load, start };
}
