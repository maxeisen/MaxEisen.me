import { describe, it, expect } from "vitest";
import { buildCyclingDashboard } from "./cycling.js";
import { buildDashboard } from "./metrics.js";

const THRESHOLDS = {
	maxHr: 191,
	restingHr: 47,
	lactateThresholdHr: 175,
	thresholdPaceSecPerKm: 243,
	marathonPaceSecPerKm: 299,
};

const PLAN = {
	race: { name: "Chicago Marathon", date: "2026-10-11", goalTimeSec: 12600, distanceM: 42195 },
	thresholds: THRESHOLDS,
	weeks: [{ start: "2026-10-19", targetKm: 40, longRunKm: 16, key: [] }],
};

function shapedRide(overrides = {}) {
	return {
		id: 1,
		name: "Ride",
		sport: "ride",
		type: "Ride",
		startDateLocal: "2026-10-20T08:00:00",
		distanceM: 40_000,
		movingTimeSec: 5000,
		elevationGainM: 200,
		averageHr: 140,
		maxHr: 160,
		averageCadence: 85,
		deviceWatts: true,
		averageWatts: 180,
		load: 80,
		loadMethod: "hr",
		zoneSeconds: [100, 400, 50, 0, 0],
		...overrides,
	};
}

function shapedRun(overrides = {}) {
	return {
		id: 2,
		name: "Run",
		sport: "run",
		type: "Run",
		startDateLocal: "2026-10-21T08:00:00",
		distanceM: 10_000,
		movingTimeSec: 3000,
		averageHr: 150,
		paceSecPerKm: 300,
		gapPaceSecPerKm: 300,
		load: 70,
		loadMethod: "hr",
		...overrides,
	};
}

describe("buildCyclingDashboard", () => {
	it("keeps runs out of cycling fitness and rides out of running fitness", () => {
		const ride = shapedRide({ id: 1, startDateLocal: "2026-10-20T08:00:00", load: 80, distanceM: 40_000, movingTimeSec: 5000, sport: "ride" });
		const run = shapedRun({ id: 2, startDateLocal: "2026-10-21T08:00:00", load: 70, distanceM: 10_000, sport: "run" });
		const cycling = buildCyclingDashboard({ activities: [ride, run], today: "2026-10-22", recovery: [], thresholds: THRESHOLDS });
		const running = buildDashboard({ activities: [ride, run], plan: PLAN, today: "2026-10-22", recovery: [] });
		expect(cycling.series.map((d) => d.load)).not.toEqual(running.series.map((d) => d.load));
		expect(cycling.summary.latest.ctl).not.toBe(running.summary.latest.ctl);
	});

	it("does not load a ride that has no heart rate", () => {
		const ride = shapedRide({ load: null, averageHr: null, startDateLocal: "2026-10-20T08:00:00" });
		const dash = buildCyclingDashboard({ activities: [ride], today: "2026-10-20", recovery: [], thresholds: THRESHOLDS });
		expect(dash.activities).toHaveLength(1);
		expect(dash.series.find((d) => d.date === "2026-10-20").load).toBe(0);
	});

	it("plots meter watts per heartbeat and skips estimated power and hard rides", () => {
		const activities = [
			shapedRide({ id: 1, startDateLocal: "2026-10-18T08:00:00", averageHr: 130, averageWatts: 160, deviceWatts: true }),
			shapedRide({ id: 2, startDateLocal: "2026-10-19T08:00:00", averageHr: 132, averageWatts: 180, deviceWatts: true }),
			shapedRide({ id: 3, startDateLocal: "2026-10-20T08:00:00", averageHr: 134, averageWatts: 200, deviceWatts: true }),
			shapedRide({ id: 4, startDateLocal: "2026-10-21T08:00:00", averageHr: 130, averageWatts: 220, deviceWatts: false }),
			shapedRide({ id: 5, startDateLocal: "2026-10-22T08:00:00", averageHr: 175, averageWatts: 280, deviceWatts: true }),
		];
		const dash = buildCyclingDashboard({ activities, today: "2026-10-22", recovery: [], thresholds: THRESHOLDS });
		expect(dash.efficiency.points).toHaveLength(3);
		expect(dash.efficiency.points.every((p) => activities.find((a) => a.startDateLocal.startsWith(p.date)).deviceWatts)).toBe(true);
	});

	it("describes the last ride against cycling form, not a plan", () => {
		const rides = [
			shapedRide({ id: 9, startDateLocal: "2026-10-13T08:00:00", load: 40, zoneSeconds: [100, 0, 0, 0, 0] }),
			shapedRide({ id: 1, startDateLocal: "2026-10-20T08:00:00", zoneSeconds: [0, 0, 0, 80, 0] }),
			shapedRide({ id: 2, startDateLocal: "2026-10-20T18:00:00", zoneSeconds: [0, 0, 0, 80, 0] }),
			shapedRun({ id: 3, startDateLocal: "2026-10-20T12:00:00", zoneSeconds: [500, 0, 0, 0, 0] }),
		];
		const dash = buildCyclingDashboard({ activities: rides, today: "2026-10-20", recovery: [], thresholds: THRESHOLDS });
		expect(dash.lastRide.impact.form).toEqual(expect.objectContaining({
			ctlDelta: expect.any(Number),
			atlDelta: expect.any(Number),
			tsbDelta: expect.any(Number),
		}));
		expect(dash.lastRide.splits).toBeUndefined();
		expect(dash.lastRide.impact.week).toBeUndefined();
		expect(dash.lastRide.effort).toBe("hard");
		expect(dash.lastRide.ridesThatDay).toBe(2);
		expect(dash.summary.intensity.hardSec).toBe(160);
		expect(dash.week.rides).toHaveLength(2);
		expect(dash.today.session).toBeUndefined();
		expect(dash.today.prediction).toBeUndefined();
	});
});
