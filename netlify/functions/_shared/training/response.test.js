import { describe, it, expect } from "vitest";
import { strainSignal, TEMP_RISE_C } from "./response.js";

describe("strainSignal", () => {
	const stressed = { restingHr: { delta: 6 }, hrv: { deltaPct: -18 }, latest: {} };
	const rested = { restingHr: { delta: 0 }, hrv: { deltaPct: 2 }, latest: {} };

	it("calls deep form with markers to match buried", () => {
		expect(strainSignal({ tsb: -30, recovery: stressed }).state).toBe("buried");
	});

	it("calls deep form with a body at baseline absorbing", () => {
		// The case form alone gets wrong: −30 reads as "back off" and the
		// body's own numbers say the work is landing.
		const signal = strainSignal({ tsb: -30, recovery: rested });
		expect(signal.state).toBe("absorbing");
		expect(signal.restingHrUp).toBe(false);
	});

	it("calls a stressed body with no training behind it unexplained", () => {
		const signal = strainSignal({ tsb: 4, recovery: stressed });
		expect(signal.state).toBe("unexplained");
		expect(signal.hrvDown).toBe(true);
	});

	it("says nothing when both agree there's nothing to say", () => {
		expect(strainSignal({ tsb: 2, recovery: rested }).state).toBe("clear");
	});

	it("notes a raised temperature as evidence, never as a trigger", () => {
		const warm = { ...rested, latest: { temperatureDeviationC: TEMP_RISE_C + 0.2 } };
		const signal = strainSignal({ tsb: 2, recovery: warm });
		expect(signal.temperatureUp).toBe(true);
		expect(signal.state).toBe("clear");
	});

	it("is null with no ring data at all", () => {
		expect(strainSignal({ tsb: -30, recovery: null })).toBeNull();
	});
});
