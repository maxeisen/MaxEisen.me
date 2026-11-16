import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	sizeKeys, sizeOf, setSize, validateSizes, readSizes, writeSizes, clearSizes,
} from "./widgetSize.js";
import { WIDGET_SIZES } from "../widgets/sizes.js";

const HN = {
	id: "hn",
	sizes: { s: { w: 1, h: 2 }, m: { w: 2, h: 2 }, l: { w: 2, h: 3 } },
	defaultSize: "m",
};
const CLOCKS = { id: "clocks", sizes: { s: { w: 1, h: 1 }, m: { w: 2, h: 1 } }, defaultSize: "m" };

describe("sizeOf", () => {
	it("uses the default, free to grow, when nothing was picked", () => {
		expect(sizeOf({}, HN)).toEqual({ key: "m", w: 2, h: 2, fixed: false });
	});

	it("uses a picked size and keeps it fixed, even when it's the default", () => {
		expect(sizeOf({ hn: "l" }, HN)).toEqual({ key: "l", w: 2, h: 3, fixed: true });
		expect(sizeOf({ hn: "m" }, HN)).toEqual({ key: "m", w: 2, h: 2, fixed: true });
	});

	it("ignores a picked size the widget doesn't offer", () => {
		expect(sizeOf({ clocks: "l" }, CLOCKS)).toMatchObject({ key: "m", fixed: false });
	});
});

describe("sizeKeys", () => {
	it("lists the sizes a widget offers, smallest first", () => {
		expect(sizeKeys(HN)).toEqual(["s", "m", "l"]);
		expect(sizeKeys(CLOCKS)).toEqual(["s", "m"]);
	});
});

describe("setSize", () => {
	it("returns a new map with the choice recorded", () => {
		const before = { hn: "s" };
		const after = setSize(before, "hn", "l");
		expect(after).toEqual({ hn: "l" });
		expect(before).toEqual({ hn: "s" });
	});
});

describe("validateSizes", () => {
	it("keeps known widgets mapped to sizes they offer", () => {
		expect(validateSizes({ hn: "l", clocks: "l", gone: "s", x: 3 }, [HN, CLOCKS])).toEqual({ hn: "l" });
	});

	it("rejects anything that isn't a plain object", () => {
		expect(validateSizes(null, [HN])).toEqual({});
		expect(validateSizes(["s"], [HN])).toEqual({});
		expect(validateSizes("s", [HN])).toEqual({});
	});
});

describe("storage", () => {
	let store;
	beforeEach(() => {
		store = new Map();
		vi.stubGlobal("localStorage", {
			getItem: (k) => (store.has(k) ? store.get(k) : null),
			setItem: (k, v) => store.set(k, String(v)),
			removeItem: (k) => store.delete(k),
		});
	});

	it("round-trips choices and clears them", () => {
		writeSizes("k", { hn: "s" });
		expect(readSizes("k", [HN])).toEqual({ hn: "s" });
		clearSizes("k");
		expect(readSizes("k", [HN])).toEqual({});
	});

	it("reads junk as no choices", () => {
		store.set("k", "{not json");
		expect(readSizes("k", [HN])).toEqual({});
	});

	it("survives storage that throws", () => {
		vi.stubGlobal("localStorage", {
			getItem: () => { throw new Error("denied"); },
			setItem: () => { throw new Error("denied"); },
			removeItem: () => { throw new Error("denied"); },
		});
		expect(readSizes("k", [HN])).toEqual({});
		expect(writeSizes("k", { hn: "s" })).toBe(false);
		expect(() => clearSizes("k")).not.toThrow();
	});
});

describe("WIDGET_SIZES", () => {
	it("gives every widget a default size it offers, and sizes that grow", () => {
		for (const [id, sizing] of Object.entries(WIDGET_SIZES)) {
			const widget = { id, ...sizing };
			expect(widget.sizes?.[widget.defaultSize], widget.id).toBeTruthy();
			const areas = sizeKeys(widget).map((key) => widget.sizes[key].w * widget.sizes[key].h);
			expect(areas.length, widget.id).toBeGreaterThanOrEqual(2);
			for (let i = 1; i < areas.length; i += 1) expect(areas[i], widget.id).toBeGreaterThan(areas[i - 1]);
		}
	});
});
