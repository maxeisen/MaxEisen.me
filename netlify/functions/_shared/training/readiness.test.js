import { describe, it, expect } from "vitest";
import { readiness } from "./readiness.js";

// A month of nights so the 28-day baselines have something to stand on.
function recovery({
	sleepSec = 7 * 3600,
	averageHrv = 80,
	restingHr = 48,
	day = "2026-08-19",
	baselineSleepSec = 7 * 3600,
	baselineHrv = 80,
	baselineRhr = 48,
} = {}) {
	const hrvDeltaPct =
		Number.isFinite(averageHrv) && baselineHrv > 0
			? ((averageHrv - baselineHrv) / baselineHrv) * 100
			: null;
	const rhrDelta = Number.isFinite(restingHr) ? restingHr - baselineRhr : null;
	return {
		latest: { day, sleepSec, averageHrv, restingHr },
		sleep: { baseline: baselineSleepSec },
		hrv: { baseline: baselineHrv, deltaPct: hrvDeltaPct },
		restingHr: { baseline: baselineRhr, delta: rhrDelta },
	};
}

describe("readiness", () => {
	it("is null with no ring data at all, even when form is deep", () => {
		expect(readiness({ tsb: -30, recovery: null })).toBeNull();
	});

	it("is null when the night has no overnight readings, rather than echoing form", () => {
		const empty = recovery({
			sleepSec: null,
			averageHrv: null,
			restingHr: null,
		});
		expect(readiness({ tsb: -18, recovery: empty })).toBeNull();
	});

	it("does not let a bounce-back HRV night print as sixty form-points", () => {
		// Production 2026-08-19: 8.2h, HRV 120, RHR 44, against a month that
		// includes crash nights of HRV 22. Percent-for-point called that
		// +68 and averaged it with form of 0 into readiness +23 — a great
		// night, not a different sport. 15% HRV is the notable drop we
		// already use; that scores 10, and a term cannot outrun ±15.
		const out = readiness({
			tsb: 0.13,
			recovery: recovery({
				sleepSec: 29580,
				averageHrv: 120,
				restingHr: 44,
				baselineSleepSec: 24633,
				baselineHrv: 71.57,
				baselineRhr: 49.29,
			}),
		});
		expect(out.terms.hrv).toBeLessThanOrEqual(15);
		expect(out.terms.hrv).toBeGreaterThan(0);
		expect(out.terms.rhr).toBeGreaterThan(0);
		expect(out.terms.sleep).toBeGreaterThan(0);
		expect(out.value).toBeGreaterThan(0);
		expect(out.value).toBeLessThan(15);
		expect(out.readings.averageHrv).toBe(120);
		expect(out.readings.restingHr).toBe(44);
		expect(out.readings.restingHr).toBeLessThan(out.readings.rhrBaseline);
	});

	it("inverts a raised resting heart rate: above baseline is a negative term", () => {
		const out = readiness({
			tsb: 0,
			recovery: recovery({ restingHr: 53, sleepSec: 7 * 3600, averageHrv: 80 }),
		});
		expect(out.terms.rhr).toBe(-10);
	});

	it("drops a missing ingredient from the mean instead of treating it as zero", () => {
		const out = readiness({
			tsb: -18,
			recovery: recovery({ averageHrv: null }),
		});
		expect(out.terms.hrv).toBeNull();
		// Form −18, sleep 0, RHR 0 → mean of three, not of four with a zero HRV.
		expect(out.value).toBeCloseTo(-6, 6);
	});

	it("does not divide by a zero HRV baseline", () => {
		const out = readiness({
			tsb: -12,
			recovery: recovery({ baselineHrv: 0, averageHrv: 70 }),
		});
		expect(out.terms.hrv).toBeNull();
	});

	it("moves only the form term when today's run lands", () => {
		const night = recovery({
			sleepSec: 6 * 3600,
			averageHrv: 73.6,
			restingHr: 51,
		});
		const before = readiness({ tsb: -18, recovery: night });
		const after = readiness({ tsb: -23, recovery: night });
		expect(after.terms.sleep).toBe(before.terms.sleep);
		expect(after.terms.hrv).toBe(before.terms.hrv);
		expect(after.terms.rhr).toBe(before.terms.rhr);
		expect(after.value).toBeCloseTo(before.value + (-23 - -18) / 4, 6);
	});

	it("dates the night it used, so the page can say when it isn't last night", () => {
		const out = readiness({
			tsb: 2,
			recovery: recovery({ day: "2026-08-17" }),
		});
		expect(out.night).toBe("2026-08-17");
	});

	it("carries the strain word as a caption, not as a second score", () => {
		const out = readiness({
			tsb: -30,
			recovery: recovery({ restingHr: 56 }),
		});
		expect(out.strain).toBe("buried");
		expect(out.value).not.toBe(out.strain);
	});
});
