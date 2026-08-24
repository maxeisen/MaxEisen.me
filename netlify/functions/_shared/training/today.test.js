import { describe, it, expect } from "vitest";
import { fitnessSeries } from "./fitness.js";
import { predictRace } from "./predict.js";
import { sessionOf, todayBriefing } from "./today.js";

describe("sessionOf", () => {
	it("is rest when nothing was planned and nothing was run", () => {
		expect(sessionOf({ planned: [], actualKm: 0, runs: 0 })).toBe("rest");
	});

	it("is extra when a run landed on a day with no planned session", () => {
		expect(sessionOf({ planned: [], actualKm: 10, runs: 1 })).toBe("extra");
	});

	it("is done when the planned run has been run", () => {
		expect(
			sessionOf({
				planned: [{ type: "easy", isRun: true, distanceKm: 10 }],
				actualKm: 10.2,
				runs: 1,
			}),
		).toBe("done");
	});

	it("is ahead when today still has a planned run outstanding", () => {
		expect(
			sessionOf({
				planned: [{ type: "intervals", isRun: true, distanceKm: 8 }],
				actualKm: 0,
				runs: 0,
			}),
		).toBe("ahead");
	});

	it("ignores planned strength so a gym day with no run is rest", () => {
		expect(
			sessionOf({
				planned: [{ type: "strength", isRun: false, distanceKm: null }],
				actualKm: 0,
				runs: 0,
			}),
		).toBe("rest");
	});
});

describe("todayBriefing", () => {
	const from = "2026-08-01";
	const today = "2026-08-19";
	const yesterday = "2026-08-18";

	function briefing(loads, extra = {}) {
		const series = fitnessSeries(loads, { from, to: today });
		return todayBriefing({
			date: today,
			series,
			day: extra.day ?? { date: today, planned: [], actualKm: 0, runs: 0 },
			recovery: extra.recovery ?? null,
			efforts: extra.efforts,
			targetDistanceM: extra.targetDistanceM,
			projectedSec: extra.projectedSec,
		});
	}

	it("records a rest day's decay rather than leaving the deltas at zero", () => {
		const loads = { [yesterday]: 80, [today]: 0 };
		const out = briefing(loads);
		expect(out.training.load).toBe(0);
		expect(out.training.atlDelta).toBeLessThan(0);
		expect(out.training.tsbDelta).toBeGreaterThan(0);
		expect(out.session.status).toBe("rest");
	});

	it("does not call today done because yesterday's last run exists", () => {
		const loads = { [yesterday]: 90, [today]: 0 };
		const out = briefing(loads, {
			day: {
				date: today,
				planned: [{ type: "easy", isRun: true, distanceKm: 10, detail: "10k easy" }],
				actualKm: 0,
				runs: 0,
			},
		});
		expect(out.session.status).toBe("ahead");
		expect(out.training.load).toBe(0);
	});

	it("includes today's run in the FFF deltas once it has landed", () => {
		const rest = briefing({ [yesterday]: 80, [today]: 0 });
		const ran = briefing(
			{ [yesterday]: 80, [today]: 100 },
			{
				day: {
					date: today,
					planned: [{ type: "easy", isRun: true, distanceKm: 10 }],
					actualKm: 10,
					runs: 1,
				},
			},
		);
		expect(ran.session.status).toBe("done");
		expect(ran.training.load).toBe(100);
		expect(ran.training.atlDelta).toBeGreaterThan(rest.training.atlDelta);
	});

	it("reports no projection change when today has not been run", () => {
		const out = briefing(
			{ [today]: 0 },
			{
				efforts: [{ date: yesterday, distanceM: 10000, timeSec: 2580, name: "10K" }],
				targetDistanceM: 42195,
			},
		);
		expect(out.prediction.ranToday).toBe(false);
		expect(out.prediction.sessionDeltaSec).toBeNull();
		expect(out.prediction.predictedSec).toBeGreaterThan(0);
	});

	it("reports zero projection delta when today's run does not beat the basis", () => {
		const out = briefing(
			{ [today]: 80 },
			{
				day: { date: today, planned: [], actualKm: 6, runs: 1 },
				efforts: [
					{ date: yesterday, distanceM: 10000, timeSec: 2580, name: "10K" },
					{ date: today, distanceM: 6000, timeSec: 1800, name: "6k" },
				],
				targetDistanceM: 42195,
			},
		);
		expect(out.prediction.ranToday).toBe(true);
		expect(out.prediction.sessionDeltaSec).toBe(0);
	});

	it("reports the time today's effort moved the projection", () => {
		const prior = [{ date: yesterday, distanceM: 10000, timeSec: 2580, name: "10K" }];
		const faster = { date: today, distanceM: 5000, timeSec: 1080, name: "5k" };
		const out = briefing(
			{ [today]: 80 },
			{
				day: { date: today, planned: [], actualKm: 5, runs: 1 },
				efforts: [...prior, faster],
				targetDistanceM: 42195,
			},
		);
		const after = predictRace([...prior, faster], 42195);
		const before = predictRace(prior, 42195);
		expect(out.prediction.ranToday).toBe(true);
		expect(out.prediction.sessionDeltaSec).toBe(Math.round(after.predictedSec - before.predictedSec));
		expect(out.prediction.sessionDeltaSec).toBeLessThan(0);
		expect(out.prediction.predictedSec).toBe(after.predictedSec);
	});

	it("uses the dashboard projection when one is provided", () => {
		const out = briefing(
			{ [today]: 0 },
			{
				efforts: [{ date: yesterday, distanceM: 10000, timeSec: 2580, name: "10K" }],
				targetDistanceM: 42195,
				projectedSec: 12300,
			},
		);
		expect(out.prediction.predictedSec).toBe(12300);
		expect(out.prediction.sessionDeltaSec).toBeNull();
	});

	it("leaves training null on the first day of the series rather than inventing a yesterday", () => {
		const series = fitnessSeries({ "2026-08-19": 40 }, { from: today, to: today });
		const out = todayBriefing({
			date: today,
			series,
			day: { planned: [], actualKm: 0, runs: 0 },
		});
		expect(out.training.tsbDelta).toBeNull();
		expect(out.training.tsb).toEqual(expect.any(Number));
	});

	it("is null-readiness without a ring, and never copies form into it", () => {
		const out = briefing({ [today]: 50 });
		expect(out.readiness).toBeNull();
		expect(out.training.tsb).not.toBeNull();
	});
});
