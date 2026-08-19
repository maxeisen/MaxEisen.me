import { describe, it, expect } from "vitest";
import { fitnessSeries } from "./fitness.js";
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
			prediction: extra.prediction ?? null,
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

	it("marks the projection as moved only when today's effort is the basis", () => {
		const prediction = {
			predictedSec: 13200,
			deltaSec: -300,
			onTrack: true,
			basis: { date: yesterday, distanceM: 5000, timeSec: 1200 },
		};
		const held = briefing({ [today]: 0 }, { prediction });
		expect(held.prediction.movedToday).toBe(false);
		expect(held.prediction.predictedSec).toBe(13200);

		const moved = briefing(
			{ [today]: 0 },
			{ prediction: { ...prediction, basis: { ...prediction.basis, date: today } } },
		);
		expect(moved.prediction.movedToday).toBe(true);
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
