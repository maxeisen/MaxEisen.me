import { describe, it, expect } from "vitest";
import {
	nightAfter,
	nightAfterDay,
	nightBeforeDay,
	nightsUntilBackTo,
	overnightCost,
	strainSignal,
	TEMP_RISE_C,
} from "./response.js";
import { addDays } from "./dates.js";

const hours = (h) => Math.round(h * 3600);

/**
 * A run of nights ending on `to`, each one whatever `shape` says for its index
 * counted back from the end (0 is the last night).
 */
function nights(to, count, shape = () => ({})) {
	return Array.from({ length: count }, (_, i) => {
		const back = count - 1 - i;
		return {
			day: addDays(to, -back),
			sleepSec: hours(7.5),
			restingHr: 46,
			averageHrv: 60,
			...shape(back),
		};
	});
}

/** A fitness series of the same span, with `loads` keyed by day key. */
function series(to, count, loads = {}) {
	return Array.from({ length: count }, (_, i) => {
		const date = addDays(to, -(count - 1 - i));
		return { date, load: loads[date] || 0, ctl: 40, atl: 40, tsb: 0 };
	});
}

describe("nightAfter", () => {
	it("takes the night dated the morning after the run", () => {
		// Oura files a night under the day you wake into it, so Tuesday's run
		// is followed by Wednesday's record.
		const records = nights("2026-08-12", 3);
		expect(nightAfter(records, "2026-08-11").day).toBe("2026-08-12");
	});

	it("has nothing for a run this morning", () => {
		const records = nights("2026-08-12", 3);
		expect(nightAfter(records, "2026-08-12")).toBeNull();
	});
});

describe("nightAfterDay", () => {
	it("reads the night against the month before it", () => {
		const records = nights("2026-08-12", 30, (back) =>
			back === 0 ? { sleepSec: hours(6), restingHr: 52, averageHrv: 48 } : {},
		);

		const night = nightAfterDay(records, "2026-08-11");

		expect(night.day).toBe("2026-08-12");
		expect(night.sleep.value).toBe(hours(6));
		expect(night.sleep.baseline).toBeCloseTo(hours(7.5), 0);
		expect(night.sleep.delta).toBeCloseTo(-hours(1.5), 0);
		expect(night.restingHr.delta).toBeCloseTo(6, 5);
		expect(night.hrv.deltaPct).toBeCloseTo(-20, 5);
	});

	it("excludes the night itself from its own baseline", () => {
		// Otherwise a bad night quietly drags down the average it's being
		// measured against, and cancels part of its own signal.
		const records = nights("2026-08-12", 30, (back) => (back === 0 ? { restingHr: 60 } : {}));
		expect(nightAfterDay(records, "2026-08-11").restingHr.baseline).toBe(46);
	});

	it("reports the night without a delta when there's no baseline yet", () => {
		const records = nights("2026-08-12", 2, (back) => (back === 0 ? { restingHr: 52 } : {}));
		const night = nightAfterDay(records, "2026-08-11");
		expect(night.restingHr.value).toBe(52);
		expect(night.restingHr.baseline).toBeNull();
		expect(night.restingHr.delta).toBeNull();
	});

	it("carries the skin temperature, which nothing else reads", () => {
		const records = nights("2026-08-12", 30, (back) =>
			back === 0 ? { temperatureDeviationC: 0.8 } : {},
		);
		expect(nightAfterDay(records, "2026-08-11").temperatureDeviationC).toBe(0.8);
	});

	it("is null when the ring recorded nothing that morning", () => {
		expect(nightAfterDay(nights("2026-08-10", 20), "2026-08-11")).toBeNull();
	});
});

describe("nightBeforeDay", () => {
	it("takes the night you woke up from on the day itself", () => {
		// The half of the question that exists on the morning of a run: what
		// you took into it, rather than what it cost.
		const records = nights("2026-08-12", 30, (back) => (back === 1 ? { sleepSec: hours(5) } : {}));
		const night = nightBeforeDay(records, "2026-08-11");
		expect(night.day).toBe("2026-08-11");
		expect(night.sleep.value).toBe(hours(5));
		expect(night.sleep.delta).toBeLessThan(0);
	});
});

describe("overnightCost", () => {
	const today = "2026-08-12";

	// Every third day is hard, and the night after a hard day is 40 minutes
	// shorter with a heart rate 4 beats up.
	function block({ hardEvery = 3, hardCost = true } = {}) {
		const days = 30;
		const loads = {};
		const hardDays = new Set();
		for (let back = 1; back <= days; back++) {
			const date = addDays(today, -back);
			const hard = back % hardEvery === 0;
			loads[date] = hard ? 120 : 45;
			if (hard) {
				hardDays.add(addDays(date, 1));
			}
		}
		return {
			series: series(today, days + 1, loads),
			records: nights(today, days, (back) => {
				const day = addDays(today, -back);
				if (!hardCost || !hardDays.has(day)) {
					return {};
				}
				return { sleepSec: hours(7.5) - 2400, restingHr: 50, averageHrv: 52 };
			}),
		};
	}

	it("compares the nights after hard days against the nights after everything else", () => {
		const { series: fitness, records } = block();

		const cost = overnightCost({ records, series: fitness, today });

		expect(cost.afterHard.nights).toBeGreaterThanOrEqual(4);
		expect(cost.afterEasy.nights).toBeGreaterThanOrEqual(4);
		expect(cost.sleepDeltaSec).toBe(-2400);
		expect(cost.restingHrDelta).toBe(4);
		expect(cost.hrvDelta).toBe(-8);
	});

	it("says nothing when hard days cost nothing", () => {
		const { series: fitness, records } = block({ hardCost: false });
		const cost = overnightCost({ records, series: fitness, today });
		expect(cost.restingHrDelta).toBe(0);
		expect(cost.sleepDeltaSec).toBe(0);
	});

	it("counts the nights until the heart rate is back down", () => {
		const { series: fitness, records } = block();
		const cost = overnightCost({ records, series: fitness, today });
		// The night after a hard day is the raised one, and the one after
		// that is back at the easy-day median.
		expect(cost.nightsToBaseline).toBe(2);
	});

	it("holds back until there are enough nights on both sides", () => {
		const loads = { [addDays(today, -2)]: 120, [addDays(today, -4)]: 40 };
		expect(
			overnightCost({ records: nights(today, 5), series: series(today, 6, loads), today }),
		).toBeNull();
	});

	it("is null before there's any load to divide the days by", () => {
		expect(overnightCost({ records: nights(today, 20), series: series(today, 20), today })).toBeNull();
	});

	it("splits by rank, so a block of near-identical days still compares", () => {
		// The threshold version of this fell over here: with most days on the
		// same load, a cut at the two-thirds mark lands on that load and every
		// day ends up "hard".
		const days = 30;
		const loads = {};
		for (let back = 1; back <= days; back++) {
			loads[addDays(today, -back)] = back % 5 === 0 ? 101 : 100;
		}

		const cost = overnightCost({ records: nights(today, days), series: series(today, days + 1, loads), today });

		expect(cost.afterHard.nights).toBe(10);
		expect(cost.afterEasy.nights).toBe(20);
	});

	it("ignores today, whose night hasn't happened yet", () => {
		const { series: fitness, records } = block();
		const spiked = fitness.map((d) => (d.date === today ? { ...d, load: 400 } : d));

		expect(overnightCost({ records, series: spiked, today })).toEqual(
			overnightCost({ records, series: fitness, today }),
		);
	});
});

describe("nightsUntilBackTo", () => {
	it("counts from the night after the day itself", () => {
		const records = nights("2026-08-14", 5, (back) => ({ restingHr: back === 2 ? 52 : 46 }));
		// The run was on the 11th; the raised night is the 12th, and the 13th
		// is back down.
		expect(nightsUntilBackTo(records, "2026-08-11", 46)).toBe(2);
	});

	it("caps rather than reporting a week", () => {
		const records = nights("2026-08-20", 12, () => ({ restingHr: 55 }));
		expect(nightsUntilBackTo(records, "2026-08-11", 46)).toBe(5);
	});

	it("steps over a night the ring missed", () => {
		const records = nights("2026-08-16", 6, (back) => ({ restingHr: back === 3 ? 44 : 55 })).filter(
			(night) => night.day !== "2026-08-12",
		);
		expect(nightsUntilBackTo(records, "2026-08-11", 46)).toBe(2);
	});

	it("says nothing at all when the ring recorded nothing", () => {
		expect(nightsUntilBackTo(nights("2026-08-11", 5), "2026-08-11", 46)).toBeNull();
	});
});

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
