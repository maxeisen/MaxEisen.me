import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { GLOSSARY } from "./glossary.js";

const SECTIONS_DIR = join(import.meta.dirname, "..", "sections");

describe("GLOSSARY", () => {
	it("gives every entry a title and something to say", () => {
		for (const [key, entry] of Object.entries(GLOSSARY)) {
			expect(entry.title, `${key} has no title`).toBeTruthy();
			expect(entry.body?.length, `${key} has no body`).toBeGreaterThan(0);
			for (const paragraph of entry.body) {
				expect(typeof paragraph).toBe("string");
				expect(paragraph.trim().length).toBeGreaterThan(0);
			}
		}
	});

	it("defines both halves of every term it lists", () => {
		for (const [key, entry] of Object.entries(GLOSSARY)) {
			for (const term of entry.terms || []) {
				expect(term.term, `${key} has an unnamed term`).toBeTruthy();
				expect(term.definition, `${key}: ${term.term} has no definition`).toBeTruthy();
			}
		}
	});

	// The point of the "i" buttons is that no panel leaves you guessing, so a
	// section added without an explanation should fail here rather than ship.
	it("is referenced by every section that renders a card", () => {
		const files = readdirSync(SECTIONS_DIR).filter((f) => f.endsWith(".svelte"));
		const referenced = new Set();

		for (const file of files) {
			const source = readFileSync(join(SECTIONS_DIR, file), "utf8");
			if (!source.includes("<Card")) continue;
			const keys = [...source.matchAll(/info=\{GLOSSARY\.(\w+)\}/g)].map((m) => m[1]);
			expect(keys.length, `${file} renders a Card with no info entry`).toBeGreaterThan(0);
			for (const key of keys) {
				expect(GLOSSARY, `${file} references GLOSSARY.${key}`).toHaveProperty(key);
				referenced.add(key);
			}
		}

		// And nothing sits here unused, quietly rotting.
		expect([...referenced].sort()).toEqual(Object.keys(GLOSSARY).sort());
	});
});
