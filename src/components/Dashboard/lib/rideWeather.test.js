import { describe, it, expect } from "vitest";
import { rideVerdict } from "./rideWeather.js";

/** Hours from 2026-11-10 at `from` o'clock, with the given overrides by index. */
function hours(from, count, base = {}, overrides = {}) {
	return Array.from({ length: count }, (_, i) => {
		const total = from + i;
		const day = 10 + Math.floor(total / 24);
		const hour = total % 24;
		return {
			time: `2026-11-${day}T${String(hour).padStart(2, "0")}:00`,
			hour,
			temp: 14,
			precip: 5,
			wind: 10,
			...base,
			...(overrides[i] || {}),
		};
	});
}

const sunsetLocal = "2026-11-10T16:53";

describe("rideVerdict", () => {
	it("calls a calm, mild afternoon good, until sunset", () => {
		expect(rideVerdict(hours(10, 24), { sunsetLocal })).toEqual({
			tone: "good", when: "today", text: "good riding weather until sunset, 4:53pm",
		});
	});

	it("says when the rain is coming", () => {
		const v = rideVerdict(hours(10, 24, {}, { 3: { precip: 70 } }), { sunsetLocal });
		expect(v).toMatchObject({ tone: "warn", text: "rain likely from 1pm" });
		expect(rideVerdict(hours(10, 24, { precip: 80 }), { sunsetLocal }).text).toBe("rain likely now");
	});

	it("flags wind, cold and heat, in that order after rain", () => {
		expect(rideVerdict(hours(10, 24, { wind: 38 }), { sunsetLocal }).text).toBe("windy, up to 38 km/h");
		expect(rideVerdict(hours(10, 24, { temp: 1 }), { sunsetLocal }).text).toBe("cold, 1° at best");
		expect(rideVerdict(hours(10, 24, { temp: 34 }), { sunsetLocal }).text).toBe("hot, up to 34°");
	});

	it("looks at tomorrow's riding hours once today's daylight is spent", () => {
		const evening = hours(17, 24, {}, { 17: { precip: 60 } }); // index 17 = 10am tomorrow
		expect(rideVerdict(evening, { sunsetLocal })).toMatchObject({
			when: "tomorrow", tone: "warn", text: "Tomorrow: rain likely from 10am",
		});
		expect(rideVerdict(hours(17, 24), { sunsetLocal })).toMatchObject({
			when: "tomorrow", tone: "good", text: "Tomorrow: good riding weather",
		});
	});

	it("has nothing to say without a forecast", () => {
		expect(rideVerdict([], { sunsetLocal })).toBeNull();
	});
});
