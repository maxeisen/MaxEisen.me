import { describe, it, expect } from "vitest";
import {
	pollIntervalForPhase,
	POLL_FAST_MS,
	POLL_LOBBY_MS,
	POLL_RESULTS_MS,
	POLL_IDLE_MS,
} from "./poll.js";

describe("pollIntervalForPhase", () => {
	it("polls fast during active phases", () => {
		for (const phase of ["writing", "generating", "reveal", "voting"]) {
			expect(pollIntervalForPhase(phase)).toBe(POLL_FAST_MS);
		}
	});

	it("backs off in the lobby and results, and idles when finished", () => {
		expect(pollIntervalForPhase("lobby")).toBe(POLL_LOBBY_MS);
		expect(pollIntervalForPhase("results")).toBe(POLL_RESULTS_MS);
		expect(pollIntervalForPhase("finished")).toBe(POLL_IDLE_MS);
	});

	it("backs off relative to the active cadence (monotonic by stability)", () => {
		expect(POLL_FAST_MS).toBeLessThan(POLL_RESULTS_MS);
		expect(POLL_RESULTS_MS).toBeLessThan(POLL_LOBBY_MS);
		expect(POLL_LOBBY_MS).toBeLessThan(POLL_IDLE_MS);
	});

	it("stays responsive (fast) for unknown/undefined phases", () => {
		expect(pollIntervalForPhase(undefined)).toBe(POLL_FAST_MS);
		expect(pollIntervalForPhase("some-future-phase")).toBe(POLL_FAST_MS);
	});
});
