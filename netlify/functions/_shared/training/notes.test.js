import { describe, it, expect } from "vitest";
import { MAX_NOTE_CHARS, shapeNotes } from "./notes.js";

describe("shapeNotes", () => {
	it("reads a tagged line", () => {
		expect(shapeNotes("excuse: wedding in the evening, cut it to 10k")).toEqual([
			{ kind: "excuse", text: "wedding in the evening, cut it to 10k" },
		]);
	});

	it("publishes nothing from an untagged description", () => {
		// The privacy case, and the reason this is an allowlist: a description
		// is written for Strava's audience, not this page's.
		expect(shapeNotes("Lovely morning out with Sam. Coffee after at ours.")).toEqual([]);
	});

	it("takes the tagged lines and leaves the rest of the description", () => {
		const notes = shapeNotes(
			["Out along the lakefront with Sam.", "excuse: legs were done", "Coffee after."].join("\n"),
		);
		expect(notes).toEqual([{ kind: "excuse", text: "legs were done" }]);
	});

	it("accepts either key, in any case, and keeps their order", () => {
		expect(shapeNotes("Note: new shoes\nEXCUSE: hip was sore")).toEqual([
			{ kind: "note", text: "new shoes" },
			{ kind: "excuse", text: "hip was sore" },
		]);
	});

	it("ignores a key with nothing after it", () => {
		expect(shapeNotes("excuse:\nnote:   ")).toEqual([]);
	});

	it("does not read a key out of the middle of a sentence", () => {
		expect(shapeNotes("I have no excuse: I just stopped")).toEqual([]);
	});

	it("collapses the whitespace a phone keyboard leaves behind", () => {
		expect(shapeNotes("note:   two   spaces\t and a tab ")[0].text).toBe("two spaces and a tab");
	});

	it("clips a pasted paragraph at a word, and says so", () => {
		const text = shapeNotes(`note: ${"word ".repeat(200)}`)[0].text;
		expect(text.length).toBeLessThanOrEqual(MAX_NOTE_CHARS + 1);
		expect(text.endsWith("…")).toBe(true);
		expect(text).not.toMatch(/\s…$/);
	});

	it("stops after a handful rather than carrying a notebook", () => {
		expect(shapeNotes("note: a\nnote: b\nnote: c\nnote: d\nnote: e")).toHaveLength(3);
	});

	it("has nothing to say about a description that isn't there", () => {
		expect(shapeNotes(undefined)).toEqual([]);
		expect(shapeNotes(null)).toEqual([]);
		expect(shapeNotes("")).toEqual([]);
		expect(shapeNotes(42)).toEqual([]);
	});
});
