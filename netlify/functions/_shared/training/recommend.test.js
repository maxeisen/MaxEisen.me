import { describe, it, expect } from "vitest";
import { recommendations } from "./recommend.js";

const ids = (out) => out.map((r) => r.id);
const find = (out, id) => out.find((r) => r.id === id);

describe("recommendations", () => {
	it("returns nothing when there are no metrics to judge", () => {
		expect(recommendations({})).toEqual([]);
		expect(recommendations(null)).toEqual([]);
	});

	it("flags ramping faster than the safe corridor", () => {
		const out = recommendations({ acwr: { ratio: 1.8 } });
		const rec = find(out, "acwr-high");
		expect(rec.severity).toBe("critical");
		expect(rec.metric).toBe(1.8);
		expect(rec.threshold).toBe(1.5);
	});

	it("flags a load drop-off", () => {
		expect(ids(recommendations({ acwr: { ratio: 0.6 } }))).toContain("acwr-low");
	});

	it("confirms a healthy ratio rather than staying silent", () => {
		const rec = find(recommendations({ acwr: { ratio: 1.1 } }), "acwr-ok");
		expect(rec.severity).toBe("good");
	});

	it("flags deep fatigue from form", () => {
		const rec = find(recommendations({ latest: { tsb: -30 } }), "tsb-fatigued");
		expect(rec.threshold).toBe(-25);
	});

	it("stays quiet on normal training fatigue", () => {
		expect(ids(recommendations({ latest: { tsb: -10 } }))).not.toContain("tsb-fatigued");
	});

	it("flags a volume jump and suggests a concrete cap", () => {
		const out = recommendations({
			rampBasis: { rampPct: 25, actualKm: 75, previousKm: 60, isCurrentWeek: true },
		});
		const rec = find(out, "ramp-fast");
		expect(rec.detail).toContain("60 to 75 km");
		expect(rec.detail).toContain("83 km");
	});

	it("says which week the ramp warning is about", () => {
		const current = find(
			recommendations({ rampBasis: { rampPct: 25, actualKm: 75, previousKm: 60, isCurrentWeek: true } }),
			"ramp-fast",
		);
		expect(current.title).toContain("This week");

		// Mid-week the basis is the previous week, and it must not be
		// described as though it were the week in progress.
		const last = find(
			recommendations({ rampBasis: { rampPct: 25, actualKm: 75, previousKm: 60, isCurrentWeek: false } }),
			"ramp-fast",
		);
		expect(last.title).toContain("Last week");
		expect(last.detail).toContain("last week");
	});

	it("flags a week built around one long run", () => {
		expect(ids(recommendations({ rampBasis: { longRunSharePct: 42 } }))).toContain("long-run-share");
	});

	it("flags easy running that isn't easy enough", () => {
		const rec = find(recommendations({ intensity: { easyPct: 62 } }), "easy-share-low");
		expect(rec.metric).toBe(62);
		expect(rec.threshold).toBe(80);
	});

	it("confirms a good intensity split", () => {
		expect(ids(recommendations({ intensity: { easyPct: 82 } }))).toContain("easy-share-ok");
	});

	it("flags heart-rate drift on the long run", () => {
		expect(ids(recommendations({ longRunDecouplingPct: 9 }))).toContain("decoupling-high");
	});

	it("only reports a volume shortfall once the week is done", () => {
		const midweek = recommendations({
			currentWeek: { volumePct: 40, weekComplete: false, actualKm: 20, targetKm: 50 },
		});
		expect(ids(midweek)).not.toContain("volume-short");

		const finished = recommendations({
			currentWeek: { volumePct: 70, weekComplete: true, actualKm: 35, targetKm: 50 },
		});
		expect(ids(finished)).toContain("volume-short");
	});

	it("raises the taper note inside three weeks", () => {
		expect(ids(recommendations({ daysToRace: 12 }))).toContain("taper");
		expect(ids(recommendations({ daysToRace: 60 }))).not.toContain("taper");
	});

	it("reports the gap to goal when projecting short", () => {
		const out = recommendations({
			prediction: { predictedSec: 13800 },
			goal: { goalTimeSec: 13200, goalPaceSecPerKm: 312.8 },
		});
		const rec = find(out, "goal-behind");
		expect(rec.title).toContain("10m");
		expect(rec.detail).toContain("5:13/km");
	});

	it("confirms being on track for the goal", () => {
		const out = recommendations({
			prediction: { predictedSec: 12900 },
			goal: { goalTimeSec: 13200, goalPaceSecPerKm: 312.8 },
		});
		expect(find(out, "goal-ahead").severity).toBe("good");
	});

	it("orders injury risk ahead of everything else", () => {
		const out = recommendations({
			acwr: { ratio: 1.9 },
			intensity: { easyPct: 85 },
			daysToRace: 10,
		});
		expect(out[0].id).toBe("acwr-high");
		expect(out.at(-1).severity).toBe("good");
	});

	// The recovery rules are the only ones reading something other than
	// training load. What they're for is the combination: load is blind to
	// whether a week was absorbed or merely survived, and sleep alone doesn't
	// know whether you were also ramping.
	describe("recovery", () => {
		const hours = (h) => Math.round(h * 3600);
		const slept = (h) => ({ recovery: { sleep: { recent: hours(h), baseline: hours(8) } } });

		it("says nothing at all without a ring", () => {
			const out = recommendations({ acwr: { ratio: 1.9 } });
			expect(ids(out)).not.toContain("sleep-short");
			expect(ids(out)).not.toContain("recovery-ok");
		});

		it("flags sustained short sleep on its own", () => {
			const rec = find(recommendations(slept(6)), "sleep-short");
			expect(rec.severity).toBe("warning");
			expect(rec.detail).toContain("6h 0m");
			// Against the athlete's own normal, not just the floor.
			expect(rec.detail).toContain("8h 0m");
		});

		it("raises it to critical when the volume is also climbing", () => {
			const out = recommendations({
				...slept(6),
				acwr: { ratio: 1.7 },
			});
			const rec = find(out, "sleep-and-ramp");
			expect(rec.severity).toBe("critical");
			expect(rec.detail).toContain("1.70");
			// One rule about the pair, not two rules about the halves.
			expect(ids(out)).not.toContain("sleep-short");
		});

		it("counts a volume jump as ramping too, not just the ratio", () => {
			const out = recommendations({
				...slept(6),
				rampBasis: { rampPct: 22, actualKm: 70, previousKm: 57 },
			});
			expect(find(out, "sleep-and-ramp").detail).toContain("22%");
		});

		it("leaves short sleep alone when the training is steady", () => {
			const out = recommendations({ ...slept(6), acwr: { ratio: 1.0 } });
			expect(ids(out)).toContain("sleep-short");
			expect(ids(out)).not.toContain("sleep-and-ramp");
		});

		it("flags an overnight heart rate above baseline", () => {
			const rec = find(
				recommendations({ recovery: { restingHr: { recent: 54, baseline: 47, delta: 7 } } }),
				"rhr-elevated",
			);
			expect(rec.severity).toBe("warning");
			expect(rec.threshold).toBe(5);
			expect(rec.detail).toContain("54 bpm");
		});

		it("stays quiet on a heart rate that has barely moved", () => {
			const out = recommendations({ recovery: { restingHr: { recent: 49, baseline: 47, delta: 2 } } });
			expect(ids(out)).not.toContain("rhr-elevated");
		});

		it("notes suppressed variability without making it an instruction", () => {
			const rec = find(
				recommendations({ recovery: { hrv: { recent: 48, baseline: 65, deltaPct: -26 } } }),
				"hrv-suppressed",
			);
			// Noisy enough night to night that it's context, not a verdict.
			expect(rec.severity).toBe("info");
			expect(rec.detail).toContain("26%");
		});

		it("confirms recovery is keeping up rather than only ever warning", () => {
			const out = recommendations({
				recovery: { sleep: { recent: hours(8) }, restingHr: { recent: 47, baseline: 47, delta: 0 } },
			});
			expect(find(out, "recovery-ok").severity).toBe("good");
		});

		it("won't call it fine while the heart rate is up", () => {
			const out = recommendations({
				recovery: {
					sleep: { recent: hours(8) },
					restingHr: { recent: 55, baseline: 47, delta: 8 },
				},
			});
			expect(ids(out)).toContain("rhr-elevated");
			expect(ids(out)).not.toContain("recovery-ok");
		});
	});

	it("carries the triggering metric and threshold on every rule", () => {
		const out = recommendations({
			acwr: { ratio: 1.9 },
			latest: { tsb: -40 },
			intensity: { easyPct: 55 },
			longRunDecouplingPct: 12,
		});
		expect(out.length).toBeGreaterThan(0);
		for (const rec of out) {
			expect(rec.id).toBeTruthy();
			expect(rec.title).toBeTruthy();
			expect(rec.detail).toBeTruthy();
			expect(Number.isFinite(rec.metric)).toBe(true);
		}
	});
});
