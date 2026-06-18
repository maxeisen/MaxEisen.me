// Visibility-aware polling timer.
//
// Runs `task` every `intervalMs` WHILE THE TAB IS VISIBLE. When the tab is
// hidden it stops polling entirely; when it becomes visible again it runs
// `task` immediately (so a returning viewer sees fresh data at once) and
// resumes the cadence. The dashboard is often left open all day but only
// looked at occasionally — this keeps full freshness while you're watching
// and goes silent otherwise, which is the difference between a few hundred
// background requests an hour and almost none. (That request firehose from a
// single residential IP is also what can trip an edge provider's per-IP abuse
// mitigation, so quieting it is both polite and self-protective.)
//
// `jitterMs` adds up to that many ms of random delay to each interval so the
// ~6 dashboard widgets don't all fire on the same tick (no synchronized
// bursts).
//
// `task` is NOT invoked immediately on creation — callers do their own
// initial load. It's called fire-and-forget (not awaited), so `task` must
// handle its own errors; only synchronous throws are guarded here.

/**
 * @param {() => void} task
 * @param {number} intervalMs
 * @param {{ jitterMs?: number }} [opts]
 * @returns {() => void} stop — clears the timer and detaches the listener.
 */
export function createPoller(task, intervalMs, { jitterMs = 0 } = {}) {
	let timer = null;

	const visible = () =>
		typeof document === "undefined" || document.visibilityState !== "hidden";

	function clear() {
		if (timer != null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function schedule() {
		clear();
		if (!visible()) return; // stay quiet while hidden
		const delay = intervalMs + (jitterMs > 0 ? Math.random() * jitterMs : 0);
		timer = setTimeout(() => {
			timer = null;
			if (visible()) {
				try { task(); } catch { /* a failed poll shouldn't kill the loop */ }
			}
			schedule();
		}, delay);
	}

	function onVisibilityChange() {
		if (visible()) {
			// Back in view: refresh now, then resume the cadence.
			try { task(); } catch { /* ignore */ }
			schedule();
		} else {
			clear();
		}
	}

	if (typeof document !== "undefined") {
		document.addEventListener("visibilitychange", onVisibilityChange);
	}
	schedule();

	return () => {
		clear();
		if (typeof document !== "undefined") {
			document.removeEventListener("visibilitychange", onVisibilityChange);
		}
	};
}
