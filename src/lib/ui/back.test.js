import { describe, it, expect } from "vitest";
import { shouldHistoryBack } from "./back.js";

describe("shouldHistoryBack", () => {
	it("uses history when this tab has a previous entry, even with no referrer", () => {
		// SPA pushState never sets document.referrer, which is how Home → Dashboard arrives.
		expect(shouldHistoryBack({ historyLength: 2, referrer: "" })).toBe(true);
	});

	it("falls back to href when this tab has nowhere to go", () => {
		expect(shouldHistoryBack({ historyLength: 1, referrer: "" })).toBe(false);
	});
});
