import { describe, it, expect } from "vitest";
import { listLoadState, listStateMessage } from "./listState.js";

describe("listLoadState", () => {
	it("returns loading when list value is null", () => {
		expect(listLoadState(null)).toBe("loading");
	});

	it("returns empty for an empty array", () => {
		expect(listLoadState([])).toBe("empty");
	});

	it("returns ready for a non-empty array", () => {
		expect(listLoadState([1])).toBe("ready");
	});

	it("treats non-array values as ready", () => {
		expect(listLoadState(undefined)).toBe("ready");
		expect(listLoadState("x")).toBe("ready");
		expect(listLoadState({})).toBe("ready");
	});
});

describe("listStateMessage", () => {
	it("returns loading text for loading state", () => {
		expect(listStateMessage("loading", "Loading…", "Unavailable")).toBe("Loading…");
	});

	it("returns empty text for empty state", () => {
		expect(listStateMessage("empty", "Loading…", "Unavailable")).toBe("Unavailable");
	});

	it("returns null for ready state", () => {
		expect(listStateMessage("ready", "Loading…", "Unavailable")).toBeNull();
	});
});
