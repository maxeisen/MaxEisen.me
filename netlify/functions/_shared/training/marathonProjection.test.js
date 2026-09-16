import { describe, expect, it } from "vitest";
import { projectMarathon, projectionSeries, sessionProjectionDelta, trainingProjection } from "./marathonProjection.js";

function run(date, distanceKm, paceSecPerKm = 300, extra = {}) {
	return {
		id: date,
		sport: "run",
		startDateLocal: `${date}T07:00:00Z`,
		distanceM: distanceKm * 1000,
		movingTimeSec: distanceKm * paceSecPerKm,
		paceSecPerKm,
		bestEfforts: [],
		...extra,
	};
}

describe("trainingProjection", () => {
	it("applies the Tanda model to the trailing eight weeks", () => {
		const runs = [
			run("2026-07-26", 40),
			run("2026-08-02", 40),
			run("2026-08-09", 40),
			run("2026-08-16", 40),
			run("2026-08-23", 40),
			run("2026-08-30", 40),
			run("2026-09-06", 40),
			run("2026-09-13", 40),
		];

		const out = trainingProjection(runs, "2026-09-16");

		expect(out.weeks).toBe(8);
		expect(out.averageKmPerWeek).toBe(40);
		expect(out.averagePaceSecPerKm).toBe(300);
		const expectedPace = 17.1 + 140 * Math.exp(-0.0053 * 40) + 0.55 * 300;
		expect(out.predictedPaceSecPerKm).toBeCloseTo(expectedPace, 6);
		expect(out.predictedSec).toBeCloseTo(expectedPace * 42.195, 6);
	});
});

describe("projectMarathon", () => {
	it("keeps an old best effort as historic potential instead of the current estimate", () => {
		const training = [
			run("2026-07-26", 40),
			run("2026-08-02", 40),
			run("2026-08-09", 40),
			run("2026-08-16", 40),
			run("2026-08-23", 40),
			run("2026-08-30", 40),
			run("2026-09-06", 40),
			run("2026-09-13", 40),
		];
		const oldRace = run("2026-05-10", 10, 258, {
			workoutType: 1,
			bestEfforts: [{ name: "10K", distanceM: 10000, timeSec: 2580, date: "2026-05-10" }],
		});

		const out = projectMarathon({
			runs: [oldRace, ...training],
			today: "2026-09-16",
			targetDistanceM: 42195,
		});

		expect(out.basis.date).toBe("2026-05-10");
		expect(out.basisAgeDays).toBe(129);
		expect(out.basisStatus).toBe("historic");
		expect(out.aerobicPotentialSec).toBeLessThan(out.trainingSec);
		expect(out.predictedSec).toBe(Math.round(out.trainingSec / 60) * 60);
	});

	it("reports marathon-specific evidence and a range around the estimate", () => {
		const runs = [
			run("2026-07-26", 35),
			run("2026-08-02", 35),
			run("2026-08-09", 35),
			run("2026-08-16", 35),
			run("2026-08-23", 35),
			run("2026-08-30", 35),
			run("2026-09-06", 35),
			run("2026-09-13", 30, 300, {
				movingTimeSec: 9000,
				decouplingPct: 7.4,
			}),
		];

		const out = projectMarathon({ runs, today: "2026-09-16" });

		expect(out.factors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "volume", tone: "limiting" }),
				expect.objectContaining({ id: "long-runs", tone: "supporting" }),
				expect.objectContaining({ id: "durability", tone: "limiting" }),
			]),
		);
		expect(out.range.fastSec).toBeLessThan(out.predictedSec);
		expect(out.range.slowSec).toBeGreaterThan(out.predictedSec);
		expect(out.confidence.label).toMatch(/low|moderate|high/);
	});

	it("does not treat a long-run split as a race-quality aerobic basis", () => {
		const training = [
			run("2026-07-26", 40),
			run("2026-08-02", 40),
			run("2026-08-09", 40),
			run("2026-08-16", 40),
			run("2026-08-23", 40),
			run("2026-08-30", 40),
			run("2026-09-06", 40),
			run("2026-09-13", 30, 300, {
				workoutType: 2,
				decouplingPct: 7.4,
				bestEfforts: [
					{ name: "10K", distanceM: 10000, timeSec: 2400, date: "2026-09-13" },
					{ name: "30K", distanceM: 30000, timeSec: 9000, date: "2026-09-13" },
				],
			}),
		];

		const out = projectMarathon({ runs: training, today: "2026-09-16" });

		expect(out.recentAerobicPotentialSec).toBeNull();
		expect(out.predictedSec).toBe(Math.round(out.trainingSec / 60) * 60);
		expect(out.unchangedReason).toMatch(/long-run/i);
	});

	it("uses a recent race as current aerobic potential", () => {
		const training = [
			run("2026-07-26", 40),
			run("2026-08-02", 40),
			run("2026-08-09", 40),
			run("2026-08-16", 40),
			run("2026-08-23", 40),
			run("2026-08-30", 40),
			run("2026-09-06", 40),
			run("2026-09-13", 40),
		];
		const race = run("2026-08-20", 10, 258, {
			workoutType: 1,
			bestEfforts: [{ name: "10K", distanceM: 10000, timeSec: 2580, date: "2026-08-20" }],
		});

		const out = projectMarathon({
			runs: [...training, race],
			today: "2026-09-16",
		});

		expect(out.basis.date).toBe("2026-08-20");
		expect(out.basisStatus).toBe("recent");
		expect(out.recentAerobicPotentialSec).toBe(out.aerobicPotentialSec);
		expect(out.predictedSec).toBe(
			Math.round(Math.max(out.recentAerobicPotentialSec, out.trainingSec) / 60) * 60,
		);
	});

	it("moves the estimate when today's long run changes training support", () => {
		const prior = [
			run("2026-07-26", 40),
			run("2026-08-02", 40),
			run("2026-08-09", 40),
			run("2026-08-16", 40),
			run("2026-08-23", 40),
			run("2026-08-30", 40),
			run("2026-09-06", 40),
		];
		const longRun = run("2026-09-16", 32, 300, { decouplingPct: 4.1 });

		const after = projectMarathon({ runs: [...prior, longRun], today: "2026-09-16" });
		const before = projectMarathon({ runs: prior, today: "2026-09-16" });
		const delta = sessionProjectionDelta({
			runs: [...prior, longRun],
			today: "2026-09-16",
			date: "2026-09-16",
		});

		expect(after.trainingSec).toBeLessThan(before.trainingSec);
		expect(delta.sessionDeltaSec).toBe(Math.round(after.predictedSec - before.predictedSec));
		expect(delta.sessionDeltaSec).toBeLessThan(0);
	});

	it("widens confidence from recovery without changing the headline", () => {
		const runs = [
			run("2026-07-26", 40),
			run("2026-08-02", 40),
			run("2026-08-09", 40),
			run("2026-08-16", 40),
			run("2026-08-23", 40),
			run("2026-08-30", 40),
			run("2026-09-06", 40),
			run("2026-09-13", 40),
		];

		const fresh = projectMarathon({ runs, today: "2026-09-16", tsb: 8 });
		const buried = projectMarathon({ runs, today: "2026-09-16", tsb: -32 });

		expect(buried.predictedSec).toBe(fresh.predictedSec);
		expect(buried.range.slowSec - buried.range.fastSec).toBeGreaterThan(
			fresh.range.slowSec - fresh.range.fastSec,
		);
		expect(buried.confidence.score).toBeLessThan(fresh.confidence.score);
	});

	it("records a weekly history of the same headline", () => {
		const runs = [
			run("2026-07-26", 30),
			run("2026-08-02", 35),
			run("2026-08-09", 35),
			run("2026-08-16", 40),
			run("2026-08-23", 40),
			run("2026-08-30", 45),
			run("2026-09-06", 45),
			run("2026-09-13", 50),
		];
		const history = projectionSeries({ runs, today: "2026-09-16", weeks: 4 });
		expect(history.length).toBeGreaterThan(1);
		expect(history.at(-1).date).toBe("2026-09-16");
		expect(history.at(-1).predictedSec).toBeLessThan(history[0].predictedSec);
	});
});
