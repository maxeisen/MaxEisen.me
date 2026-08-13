import { describe, it, expect } from "vitest";
import { median, readingsOf } from "./stats.js";

describe("median", () => {
	it("takes the middle of an odd list", () => {
		expect(median([5, 1, 3])).toBe(3);
	});

	it("splits the difference on an even one", () => {
		expect(median([1, 2, 3, 4])).toBe(2.5);
	});

	it("is null rather than zero for nothing", () => {
		expect(median([])).toBeNull();
	});

	it("leaves the caller's array alone", () => {
		const values = [3, 1, 2];
		median(values);
		expect(values).toEqual([3, 1, 2]);
	});
});

describe("readingsOf", () => {
	it("drops absent readings rather than counting them as zero", () => {
		const records = [{ hr: 46 }, { hr: null }, {}, { hr: 50 }];
		expect(readingsOf(records, "hr")).toEqual([46, 50]);
	});
});
