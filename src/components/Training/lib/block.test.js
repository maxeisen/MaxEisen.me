import { describe, it, expect } from "vitest";
import { inBlock, lastRaceLine, trainingPageMeta } from "./block.js";

const RACE = { name: "Bank of America Chicago Marathon", label: "Road to Chicago" };

describe("inBlock", () => {
	it("trusts the flag the engine stamped", () => {
		expect(inBlock({ inBlock: true, daysToRace: -1 })).toBe(true);
		expect(inBlock({ inBlock: false, daysToRace: 10 })).toBe(false);
	});

	it("falls back to the countdown when an older payload has no flag", () => {
		expect(inBlock({ daysToRace: 0 })).toBe(true);
		expect(inBlock({ daysToRace: -1 })).toBe(false);
		expect(inBlock({})).toBe(false);
	});
});

describe("trainingPageMeta", () => {
	it("keeps the race's short title while the block is on", () => {
		expect(trainingPageMeta({ inBlock: true, race: RACE }).title).toBe("Road to Chicago — Max Eisen");
	});

	it("is a running log once the block is over", () => {
		const meta = trainingPageMeta({ inBlock: false, race: RACE });
		expect(meta.title).toBe("Running — Max Eisen");
		expect(meta.card).toBe("Running");
	});
});

describe("lastRaceLine", () => {
	const past = { inBlock: false, daysToRace: -16, race: { ...RACE, date: "2026-10-11" } };

	it("names the race that's behind you, with its date", () => {
		expect(lastRaceLine(past)).toBe("Bank of America Chicago Marathon · 11 October 2026");
	});

	it("says nothing during a block or with no race on the plan", () => {
		expect(lastRaceLine({ ...past, inBlock: true, daysToRace: 10 })).toBeNull();
		expect(lastRaceLine({ inBlock: false, daysToRace: null, race: { name: null } })).toBeNull();
	});
});
