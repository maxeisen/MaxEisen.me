import { describe, it, expect } from "vitest";
import { shapeTrace, MIN_SLICE_M, TRACE_POINTS } from "./trace.js";

/**
 * A run recorded once a second.
 *
 * @param {{speed: number, sec: number, bpm?: number}[]} legs
 */
function record(legs) {
	const distance = [0];
	const time = [0];
	const heartrate = [legs[0]?.bpm ?? 0];
	for (const leg of legs) {
		for (let s = 0; s < leg.sec; s++) {
			distance.push(distance.at(-1) + leg.speed);
			time.push(time.at(-1) + 1);
			heartrate.push(leg.bpm ?? 0);
		}
	}
	return { distance, time, heartrate };
}

// 5:00/km and 4:00/km, in m/s.
const EASY = 1000 / 300;
const FAST = 1000 / 240;

describe("shapeTrace", () => {
	it("has nothing to say about a run with no streams", () => {
		expect(shapeTrace(null)).toBe(null);
		expect(shapeTrace({})).toBe(null);
		expect(shapeTrace({ distance: [0], time: [0] })).toBe(null);
		// Streams that don't line up can't be zipped, and guessing which one
		// is short would silently misplace every sample after the gap.
		expect(shapeTrace({ distance: [0, 10, 20], time: [0, 1] })).toBe(null);
	});

	it("resamples across the distance at a fixed slice width", () => {
		// 6km at 5:00/km.
		const trace = shapeTrace(record([{ speed: EASY, sec: 1800, bpm: 150 }]));
		expect(6000 / trace.m.length).toBeCloseTo(MIN_SLICE_M, -1);
		expect(trace.pace).toHaveLength(trace.m.length);
		expect(trace.hr).toHaveLength(trace.m.length);

		// Ascending, and spanning the run rather than stopping short of it.
		expect(trace.m).toEqual([...trace.m].sort((a, b) => a - b));
		expect(trace.m.at(-1)).toBeGreaterThan(5900);
		for (const pace of trace.pace) expect(pace).toBeCloseTo(300, 0);
		for (const bpm of trace.hr) expect(bpm).toBe(150);
	});

	it("caps the count so a long run costs no more than a short one", () => {
		// A marathon at the same slice width would be nearly 300 points.
		const trace = shapeTrace(record([{ speed: EASY, sec: 12_600, bpm: 145 }]));
		expect(trace.m).toHaveLength(TRACE_POINTS);
		expect(trace.m.at(-1)).toBeGreaterThan(41_000);
	});

	it("keeps the intervals a kilometre split would average away", () => {
		// Six 400m reps with 400m of jogging between them. Every kilometre of
		// this averages to much the same number, which is the whole problem.
		const legs = [];
		for (let rep = 0; rep < 6; rep++) {
			legs.push({ speed: FAST, sec: Math.round(400 / FAST), bpm: 178 });
			legs.push({ speed: EASY, sec: Math.round(400 / EASY), bpm: 140 });
		}
		const trace = shapeTrace(record(legs));

		const paces = trace.pace.filter((v) => v !== null);
		expect(Math.min(...paces)).toBeLessThan(250);
		expect(Math.max(...paces)).toBeGreaterThan(290);

		// And the heart rate swings with them rather than sitting at its mean.
		expect(Math.min(...trace.hr)).toBeLessThan(145);
		expect(Math.max(...trace.hr)).toBeGreaterThan(173);
	});

	it("keeps the heart rate through a stop that the pace filter drops", () => {
		// A rep, then standing still with the heart rate coming down, then
		// another rep. The standing samples aren't running and can't be paced,
		// but they're the recovery — the reason to draw heart rate at all. It
		// covers no ground, so it lands inside the slice it happened in and
		// pulls that slice down rather than getting one to itself.
		const legs = [
			{ speed: FAST, sec: 96, bpm: 180 },
			{ speed: 0.05, sec: 60, bpm: 120 },
			{ speed: FAST, sec: 96, bpm: 180 },
		];
		const trace = shapeTrace(record(legs));

		expect(Math.min(...trace.hr.filter((v) => v !== null))).toBeLessThan(170);
		// And nothing implausible reached the pace line.
		for (const pace of trace.pace.filter((v) => v !== null)) {
			expect(pace).toBeLessThan(400);
		}
	});

	it("prefers the activity's own distance to the last sample", () => {
		// A GPS drop at the finish leaves the stream short; the summary's
		// total is the one the rest of the page is drawn from, and a trace
		// that disagreed would put the last kilometre in the wrong place.
		const streams = record([{ speed: EASY, sec: 600, bpm: 150 }]);
		const trace = shapeTrace(streams, { distanceM: 4000 });
		expect(trace.m.at(-1)).toBeGreaterThan(3900);
		expect(trace.m.at(-1)).toBeLessThanOrEqual(4000);
	});

	it("reports a slice it couldn't measure rather than inventing one", () => {
		const trace = shapeTrace(record([{ speed: EASY, sec: 600 }]), { maxPoints: 4 });
		// No heart rate recorded at all: nulls, not zeroes, which would plot
		// as a heart that stopped.
		expect(trace.hr).toEqual([null, null, null, null]);
		expect(trace.pace.every((v) => v > 0)).toBe(true);
	});
});
