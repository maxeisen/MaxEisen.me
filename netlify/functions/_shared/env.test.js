import { describe, it, expect, afterEach } from "vitest";
import { getEnv } from "./env.js";

// In Node/vitest the global `Netlify` object is undefined, so getEnv falls back
// to process.env — the same path used for local dev and these tests.
describe("getEnv", () => {
	const KEY = "__GET_ENV_TEST__";
	afterEach(() => {
		delete process.env[KEY];
	});

	it("reads a present variable from process.env", () => {
		process.env[KEY] = "hello";
		expect(getEnv(KEY)).toBe("hello");
	});

	it("returns undefined for a missing variable", () => {
		expect(getEnv(KEY)).toBeUndefined();
	});
});
