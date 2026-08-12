import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateLayout, readLayout, writeLayout, swapSlots } from "./layoutStore.js";

const DEFAULTS = ["a", "b", "c"];

describe("validateLayout", () => {
	it("accepts any permutation of the current panels", () => {
		expect(validateLayout(["c", "a", "b"], DEFAULTS)).toEqual(["c", "a", "b"]);
	});

	it("copies rather than aliasing the stored array", () => {
		const stored = ["c", "a", "b"];
		const layout = validateLayout(stored, DEFAULTS);
		layout[0] = "b";
		expect(stored[0]).toBe("c");
	});

	// Adding a panel used to cost everyone the arrangement they'd made, since
	// a saved list of three isn't a permutation of four.
	it("keeps the saved order and slots a new panel into its default place", () => {
		expect(validateLayout(["c", "a", "b"], ["a", "b", "c", "d"])).toEqual(["c", "a", "b", "d"]);
		expect(validateLayout(["c", "a", "b"], ["new", "a", "b", "c"])).toEqual(["new", "c", "a", "b"]);
	});

	it("drops a panel the page no longer has", () => {
		expect(validateLayout(["a", "b", "gone", "c"], DEFAULTS)).toEqual(["a", "b", "c"]);
	});

	it("drops duplicates, which would otherwise leave a slot empty", () => {
		expect(validateLayout(["a", "a", "b"], DEFAULTS)).toEqual(["a", "b", "c"]);
	});

	it("always returns a full layout, whatever it was handed", () => {
		expect(validateLayout([], DEFAULTS)).toEqual(DEFAULTS);
		expect(validateLayout([1, 2, 3], DEFAULTS)).toEqual(DEFAULTS);
	});

	it("rejects anything that isn't an array", () => {
		expect(validateLayout(null, DEFAULTS)).toBeNull();
		expect(validateLayout({ 0: "a" }, DEFAULTS)).toBeNull();
		expect(validateLayout("abc", DEFAULTS)).toBeNull();
	});
});

describe("readLayout / writeLayout", () => {
	let store;

	beforeEach(() => {
		store = new Map();
		vi.stubGlobal("localStorage", {
			getItem: (k) => (store.has(k) ? store.get(k) : null),
			setItem: (k, v) => store.set(k, v),
		});
	});

	afterEach(() => vi.unstubAllGlobals());

	it("round-trips a layout", () => {
		expect(writeLayout("k", ["b", "c", "a"])).toBe(true);
		expect(readLayout("k", DEFAULTS)).toEqual(["b", "c", "a"]);
	});

	it("returns null when nothing has been saved", () => {
		expect(readLayout("k", DEFAULTS)).toBeNull();
	});

	it("survives a half-written value", () => {
		store.set("k", '["a","b"');
		expect(readLayout("k", DEFAULTS)).toBeNull();
	});

	it("survives storage being unavailable entirely", () => {
		vi.stubGlobal("localStorage", {
			getItem() { throw new Error("SecurityError"); },
			setItem() { throw new Error("QuotaExceededError"); },
		});
		expect(readLayout("k", DEFAULTS)).toBeNull();
		expect(writeLayout("k", ["a", "b", "c"])).toBe(false);
	});
});

describe("swapSlots", () => {
	it("exchanges the two panels", () => {
		expect(swapSlots(["a", "b", "c"], 0, 2)).toEqual(["c", "b", "a"]);
	});

	it("leaves the layout alone for a no-op or out-of-range swap", () => {
		const layout = ["a", "b", "c"];
		expect(swapSlots(layout, 1, 1)).toBe(layout);
		expect(swapSlots(layout, -1, 1)).toBe(layout);
		expect(swapSlots(layout, 0, 9)).toBe(layout);
		expect(swapSlots(layout, 0, null)).toBe(layout);
	});

	it("doesn't mutate the layout it was given", () => {
		const layout = ["a", "b", "c"];
		swapSlots(layout, 0, 1);
		expect(layout).toEqual(["a", "b", "c"]);
	});
});
