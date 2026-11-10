import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	isShown, setShown, validateVisibility, readVisibility, writeVisibility, clearVisibility,
} from "./widgetVisibility.js";

describe("isShown", () => {
	it("follows a choice when one was made", () => {
		expect(isShown({ hn: false }, { id: "hn" })).toBe(false);
		expect(isShown({ hn: true }, { id: "hn", defaultShown: false })).toBe(true);
	});

	it("falls back to the widget's default, which is shown", () => {
		expect(isShown({}, { id: "hn" })).toBe(true);
		expect(isShown({}, { id: "new", defaultShown: false })).toBe(false);
	});
});

describe("setShown", () => {
	it("returns a new map with the choice recorded", () => {
		const before = { hn: true };
		const after = setShown(before, "hn", false);
		expect(after).toEqual({ hn: false });
		expect(before).toEqual({ hn: true });
	});
});

describe("validateVisibility", () => {
	it("drops unknown ids and non-boolean values", () => {
		expect(validateVisibility({ hn: false, gone: false, clock: "yes" }, ["hn", "clock"]))
			.toEqual({ hn: false });
	});

	it("treats anything that isn't a plain object as no choices", () => {
		for (const bad of [null, undefined, "x", 3, ["hn"]]) {
			expect(validateVisibility(bad, ["hn"])).toEqual({});
		}
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

	it("round-trips choices", () => {
		writeVisibility("vis", { hn: false });
		expect(readVisibility("vis", ["hn"])).toEqual({ hn: false });
		clearVisibility("vis");
		expect(readVisibility("vis", ["hn"])).toEqual({});
	});

	it("reads corrupt storage as no choices", () => {
		store.set("vis", "{not json");
		expect(readVisibility("vis", ["hn"])).toEqual({});
	});

	it("survives storage that throws", () => {
		vi.stubGlobal("localStorage", {
			getItem: () => { throw new Error("denied"); },
			setItem: () => { throw new Error("denied"); },
			removeItem: () => { throw new Error("denied"); },
		});
		expect(readVisibility("vis", ["hn"])).toEqual({});
		expect(writeVisibility("vis", { hn: false })).toBe(false);
		expect(() => clearVisibility("vis")).not.toThrow();
	});
});
