import { describe, it, expect, vi, afterEach } from "vitest";
import { bindTrimOnResize } from "./listResize.js";

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("bindTrimOnResize", () => {
	it("debounces trim calls on resize", () => {
		vi.useFakeTimers();
		const trim = vi.fn();
		let handler = null;
		const windowObj = {
			addEventListener: vi.fn((_evt, fn) => {
				handler = fn;
			}),
			removeEventListener: vi.fn(),
		};

		bindTrimOnResize({ id: "list" }, { trim, debounceMs: 100, windowObj });
		expect(windowObj.addEventListener).toHaveBeenCalledWith("resize", expect.any(Function));

		handler();
		handler();
		vi.advanceTimersByTime(99);
		expect(trim).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(trim).toHaveBeenCalledTimes(1);
	});

	it("returns a cleanup that clears pending timers and detaches listener", () => {
		vi.useFakeTimers();
		const trim = vi.fn();
		let handler = null;
		const windowObj = {
			addEventListener: vi.fn((_evt, fn) => {
				handler = fn;
			}),
			removeEventListener: vi.fn(),
		};

		const cleanup = bindTrimOnResize({ id: "list" }, { trim, debounceMs: 100, windowObj });
		handler();
		cleanup();
		vi.runAllTimers();

		expect(trim).not.toHaveBeenCalled();
		expect(windowObj.removeEventListener).toHaveBeenCalledWith("resize", handler);
	});
});
