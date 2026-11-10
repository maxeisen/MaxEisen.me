import { describe, it, expect, vi } from "vitest";
import { bindTrimOnResize } from "./listResize.js";

/** A ResizeObserver stand-in whose callback the test fires by hand. */
function fakeObserver() {
	const instances = [];
	class Observer {
		constructor(callback) {
			this.callback = callback;
			this.observe = vi.fn();
			this.disconnect = vi.fn();
			instances.push(this);
		}
	}
	return { Observer, instances };
}

/** A frame scheduler the test flushes by hand. */
function fakeFrames() {
	const queue = new Map();
	let next = 1;
	return {
		schedule: (fn) => { queue.set(next, fn); return next++; },
		cancel: (id) => queue.delete(id),
		flush: () => { const fns = [...queue.values()]; queue.clear(); fns.forEach((fn) => fn()); },
		get size() { return queue.size; },
	};
}

describe("bindTrimOnResize", () => {
	it("observes the list and trims once per burst of resizes", () => {
		const { Observer, instances } = fakeObserver();
		const frames = fakeFrames();
		const trim = vi.fn();
		const list = { id: "list" };

		bindTrimOnResize(list, { trim, Observer, ...frames });
		expect(instances[0].observe).toHaveBeenCalledWith(list);

		instances[0].callback();
		instances[0].callback();
		expect(trim).not.toHaveBeenCalled();
		frames.flush();
		expect(trim).toHaveBeenCalledTimes(1);
		expect(trim).toHaveBeenCalledWith(list);

		instances[0].callback();
		frames.flush();
		expect(trim).toHaveBeenCalledTimes(2);
	});

	it("returns a cleanup that disconnects and drops a pending trim", () => {
		const { Observer, instances } = fakeObserver();
		const frames = fakeFrames();
		const trim = vi.fn();

		const cleanup = bindTrimOnResize({}, { trim, Observer, ...frames });
		instances[0].callback();
		cleanup();
		frames.flush();

		expect(trim).not.toHaveBeenCalled();
		expect(instances[0].disconnect).toHaveBeenCalled();
		expect(frames.size).toBe(0);
	});

	it("does nothing without a list or a ResizeObserver", () => {
		const trim = vi.fn();
		expect(() => bindTrimOnResize(null, { trim })()).not.toThrow();
		expect(() => bindTrimOnResize({}, { trim, Observer: null })()).not.toThrow();
	});
});
