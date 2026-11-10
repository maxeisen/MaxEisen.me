// The training summary (netlify/functions/trainingSummary) for the Running,
// Cycling, Recovery and Training-week widgets.
//
// One request feeds all four: the first subscriber starts the poll, the last
// one to leave stops it, and everything lands in `training`. The data only
// moves when the 5-minute sync runs, so polling faster would buy nothing.

/* global $state -- a compiler intrinsic, not an import. */

import { fetchJsonSwr } from "../../../lib/data/swrCache.js";
import { createPoller } from "../../../lib/data/poller.js";

export const TRAINING_SUMMARY_URL = "/.netlify/functions/trainingSummary";

export const training = $state({
	// "loading" until the first response, then "ready"; "failed" only if
	// it never loaded. A failure after that keeps the last data up.
	status: "loading",
	data: null,
});

function apply(data) {
	training.data = data;
	training.status = "ready";
}

async function load() {
	try {
		apply(await fetchJsonSwr(TRAINING_SUMMARY_URL, { maxAgeMs: 60_000, onRevalidate: apply }));
	} catch {
		if (training.status !== "ready") training.status = "failed";
	}
}

let subscribers = 0;
let stopPoll = null;

/** @returns {() => void} unsubscribe; call it on destroy. */
export function subscribeTraining() {
	subscribers += 1;
	if (subscribers === 1) {
		load();
		stopPoll = createPoller(load, 1000 * 60 * 5, { jitterMs: 15_000 });
	}
	let subscribed = true;
	return () => {
		if (!subscribed) return;
		subscribed = false;
		subscribers -= 1;
		if (subscribers === 0) {
			stopPoll?.();
			stopPoll = null;
		}
	};
}

/**
 * Report a widget's availability from the feed: available once its part of
 * the summary has arrived, unavailable if the feed failed or that part is
 * missing. Call inside an $effect.
 *
 * @param {(data: object) => boolean} has whether the data covers the widget.
 * @param {(ok: boolean) => void} onavailability
 */
export function reportTraining(has, onavailability) {
	if (training.status === "loading") return;
	onavailability(training.status === "ready" && Boolean(training.data) && has(training.data));
}
