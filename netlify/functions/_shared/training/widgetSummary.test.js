import { describe, it, expect } from "vitest";
import { widgetSummary } from "./widgetSummary.js";
import { buildTrainingFixture } from "../../../../e2e/fixtures/trainingPayload.js";
import { buildCyclingFixture } from "../../../../e2e/fixtures/cyclingPayload.js";

describe("widgetSummary", () => {
	const running = buildTrainingFixture();
	const cycling = buildCyclingFixture();
	const summary = widgetSummary({ running, cycling });

	it("is a small fraction of the pages' payloads", () => {
		const size = (value) => JSON.stringify(value).length;
		expect(size(summary)).toBeLessThan(6_000);
		expect(size(summary)).toBeLessThan(size(running) / 10);
	});

	it("carries the running page's own numbers, not recomputed ones", () => {
		expect(summary.run.form.tsb).toBeCloseTo(running.today.training.tsb, 1);
		expect(summary.run.form.ctl).toBeCloseTo(running.today.training.ctl, 1);
		expect(summary.run.last.id).toBe(running.lastRun.id);
		expect(summary.run.today.status).toBe(running.today.session.status);
		expect(summary.run.week.targetKm).toBeCloseTo(running.week.targetKm, 1);
	});

	it("counts down to the race only during a block", () => {
		expect(summary.run.race).toMatchObject({
			label: running.summary.race.label,
			daysToRace: running.summary.daysToRace,
		});
		const after = widgetSummary({ running: { ...running, summary: { ...running.summary, inBlock: false } } });
		expect(after.run.race).toBeNull();
	});

	it("keeps the last ride's power only when a meter measured it", () => {
		expect(summary.ride.last.averageWatts).toBe(cycling.lastRide.averageWatts);
		const estimated = widgetSummary({ cycling: { ...cycling, lastRide: { ...cycling.lastRide, deviceWatts: false } } });
		expect(estimated.ride.last.averageWatts).toBeNull();
	});

	it("lays out the week Monday first, with the plan and what was done", () => {
		expect(summary.week).toHaveLength(7);
		expect(summary.week.filter((day) => day.isToday)).toHaveLength(1);
		for (const day of summary.week) {
			expect(day).toHaveProperty("planned");
			expect(day.runKm).toBeGreaterThanOrEqual(0);
			expect(day.rideKm).toBeGreaterThanOrEqual(0);
		}
	});

	it("still lays out a week between blocks, from the calendar", () => {
		const offPlan = widgetSummary({ running: { ...running, week: null }, cycling });
		expect(offPlan.week).toHaveLength(7);
		expect(offPlan.week[0].planned).toEqual([]);
		expect(offPlan.week.find((day) => day.isToday)?.date).toBe(running.today.date);
	});

	it("passes recovery through from last night", () => {
		expect(summary.recovery.readinessScore).toBe(running.recovery.latest.readinessScore);
		expect(summary.recovery.value).toBeCloseTo(running.today.readiness.value, 1);
	});

	it("leaves a side null when its payload is missing", () => {
		const onlyRides = widgetSummary({ cycling });
		expect(onlyRides.run).toBeNull();
		// The week still shows the rides, with no plan to set them against.
		expect(onlyRides.week).toHaveLength(7);
		expect(onlyRides.week.every((day) => day.planned.length === 0)).toBe(true);
		expect(onlyRides.recovery).toBeNull();
		expect(onlyRides.ride.last).not.toBeNull();
	});
});
