import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPoller } from "./poller.js";

// Minimal document stub: controllable visibilityState + a visibilitychange
// listener registry, so we can simulate tab hide/show under fake timers.
function mockDocument(initial = "visible") {
	let state = initial;
	const listeners = new Set();
	global.document = {
		get visibilityState() { return state; },
		addEventListener(type, fn) { if (type === "visibilitychange") listeners.add(fn); },
		removeEventListener(type, fn) { if (type === "visibilitychange") listeners.delete(fn); },
	};
	return { set(next) { state = next; listeners.forEach((fn) => fn()); } };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); delete global.document; });

describe("createPoller", () => {
	it("doesn't run immediately, then runs once per interval while visible", () => {
		mockDocument("visible");
		const task = vi.fn();
		const stop = createPoller(task, 1000);
		expect(task).toHaveBeenCalledTimes(0);
		vi.advanceTimersByTime(1000);
		expect(task).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(2000);
		expect(task).toHaveBeenCalledTimes(3);
		stop();
	});

	it("pauses while hidden and resumes with an immediate run on return", () => {
		const doc = mockDocument("visible");
		const task = vi.fn();
		const stop = createPoller(task, 1000);
		vi.advanceTimersByTime(1000);
		expect(task).toHaveBeenCalledTimes(1);

		doc.set("hidden");
		vi.advanceTimersByTime(10_000); // no polls while hidden
		expect(task).toHaveBeenCalledTimes(1);

		doc.set("visible"); // immediate refresh on resume
		expect(task).toHaveBeenCalledTimes(2);
		vi.advanceTimersByTime(1000); // cadence resumes
		expect(task).toHaveBeenCalledTimes(3);
		stop();
	});

	it("never schedules a poll if it starts hidden", () => {
		const doc = mockDocument("hidden");
		const task = vi.fn();
		const stop = createPoller(task, 1000);
		vi.advanceTimersByTime(5000);
		expect(task).toHaveBeenCalledTimes(0);
		doc.set("visible");
		expect(task).toHaveBeenCalledTimes(1); // first run happens on becoming visible
		stop();
	});

	it("stop() halts polling and detaches the visibility listener", () => {
		const doc = mockDocument("visible");
		const task = vi.fn();
		const stop = createPoller(task, 1000);
		stop();
		vi.advanceTimersByTime(5000);
		expect(task).toHaveBeenCalledTimes(0);
		doc.set("visible"); // listener gone → no run
		expect(task).toHaveBeenCalledTimes(0);
	});

	it("keeps polling after a task throws synchronously", () => {
		mockDocument("visible");
		const task = vi.fn(() => { throw new Error("boom"); });
		const stop = createPoller(task, 1000);
		expect(() => vi.advanceTimersByTime(3000)).not.toThrow();
		expect(task).toHaveBeenCalledTimes(3);
		stop();
	});
});
