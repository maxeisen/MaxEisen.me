import { describe, it, expect } from "vitest";
import { hasCaption } from "./caption.js";
import { ATTRIBUTION, captionRecentRides, rideCaptionLines, rideCaptionWriter } from "./rideCaption.js";

const today = "2026-08-21"; // a Friday

function ride(id, day, extra = {}) {
	return {
		id,
		sport: "ride",
		startDateLocal: `${day}T07:00:00`,
		distanceM: 40000,
		movingTimeSec: 5400,
		averageHr: 140,
		load: 80,
		deviceWatts: true,
		averageWatts: 200,
		weightedAverageWatts: 218,
		...extra,
	};
}

const earlier = [
	ride(1, "2026-07-20", { averageWatts: 190, averageHr: 140 }),
	ride(2, "2026-07-30", { averageWatts: 195, averageHr: 140 }),
	ride(3, "2026-08-10", { averageWatts: 200, averageHr: 140 }),
	ride(4, "2026-08-18", { distanceM: 30000, movingTimeSec: 3600 }),
];

const series = [
	{ date: "2026-08-20", ctl: 30, atl: 35, tsb: -5, load: 0 },
	{ date: "2026-08-21", ctl: 31.2, atl: 44, tsb: -13, load: 120 },
];

describe("rideCaptionLines", () => {
	it("writes form, load, power, efficiency, intensity, the week and a longest-ride flag", () => {
		const target = ride(9, today, {
			distanceM: 80000,
			movingTimeSec: 9000,
			load: 120,
			averageWatts: 210,
			weightedAverageWatts: 231,
			averageHr: 140,
			zoneSeconds: [3000, 4200, 1200, 450, 150],
		});
		const rides = [...earlier, target];
		const lines = rideCaptionLines(target, { rides, series });

		expect(lines[0]).toMatch(/^Fitness\s+\+1\.2\s+→\s+31\.2/);
		expect(lines[1]).toMatch(/^Fatigue\s+\+9\.0/);
		expect(lines[2]).toMatch(/^Form\s+-8\.0/);
		expect(lines).toContain("Load     120  ·  150% of typical");
		expect(lines).toContain("Power    210 W avg  ·  231 W NP  ·  VI 1.10");
		// 1.50 W/bpm against a median of 1.41 over the six weeks before.
		expect(lines).toContain("Efficiency  1.50 W/bpm  ·  106% of typical");
		expect(lines).toContain("Intensity  80% easy  ·  13% moderate  ·  7% hard");
		// Monday 17th to Friday 21st: the 18th's ride and this one.
		expect(lines).toContain("Week     2 rides  ·  110 km  ·  3h 30m");
		expect(lines.at(-1)).toBe("Longest ride in 6 weeks");
	});

	it("never prints power from a ride without a meter", () => {
		const target = ride(9, today, { deviceWatts: false, averageWatts: 180, weightedAverageWatts: 190 });
		const lines = rideCaptionLines(target, { rides: [...earlier, target], series });
		expect(lines.some((l) => /Power|W\/bpm|W avg/.test(l))).toBe(false);
		expect(lines.some((l) => l.startsWith("Load"))).toBe(true);
	});

	it("leaves form out of a ride with no load, so a day's decay isn't pinned on it", () => {
		const target = ride(9, today, { load: null, averageHr: null });
		const lines = rideCaptionLines(target, { rides: [...earlier, target], series });
		expect(lines.some((l) => /Fitness|Fatigue|Form|Load|Efficiency/.test(l))).toBe(false);
		expect(lines[0]).toMatch(/^Power/);
	});

	it("has nothing to say about a ride with no heart rate, meter or zones", () => {
		const target = ride(9, today, { load: null, averageHr: null, deviceWatts: false });
		expect(rideCaptionLines(target, { rides: [...earlier, target], series })).toEqual([]);
	});

	it("doesn't call anything typical or longest on too few rides", () => {
		const target = ride(9, today, { distanceM: 90000 });
		const rides = [earlier[3], target];
		const lines = rideCaptionLines(target, { rides, series });
		expect(lines.find((l) => l.startsWith("Load"))).toBe("Load     80");
		expect(lines.find((l) => l.startsWith("Efficiency"))).not.toMatch(/typical/);
		expect(lines).not.toContain("Longest ride in 6 weeks");
	});
});

describe("rideCaptionWriter", () => {
	it("only takes rides", () => {
		const writer = rideCaptionWriter({ records: earlier, today });
		expect(writer.isEligible({ sport: "ride" })).toBe(true);
		expect(writer.isEligible({ sport: "run" })).toBe(false);
		expect(writer.isEligible({})).toBe(false);
	});
});

describe("captionRecentRides", () => {
	it("writes the cycling attribution once, and leaves runs to the running writer", async () => {
		const records = [...earlier.map((r) => ({ ...r })), ride(9, today), { id: 10, sport: "run", startDateLocal: `${today}T06:00:00`, load: 50 }];
		const puts = [];
		const out = await captionRecentRides({
			records,
			today,
			getActivity: async (id) => {
				if (id === 10) throw new Error("should not read a run");
				return { description: "windy" };
			},
			putActivity: async (id, { description }) => puts.push({ id, description }),
		});
		// The 18th is inside the three-day window too.
		expect(out.captioned).toBe(2);
		expect(puts.map((p) => p.id)).toEqual([9, 4]);
		expect(puts[0].description).toMatch(/^windy\n\n──\n/);
		expect(puts[0].description).toContain(ATTRIBUTION);
		expect(hasCaption(puts[0].description)).toBe(true);
		expect(records.find((r) => r.id === 10).captionedAt).toBeUndefined();

		const again = await captionRecentRides({
			records,
			today,
			getActivity: async () => {
				throw new Error("should not read again");
			},
			putActivity: async () => {
				throw new Error("should not write again");
			},
		});
		expect(again.captioned).toBe(0);
	});

	it("falls back to the plain cycling attribution when Strava rejects the URL", async () => {
		const puts = [];
		const out = await captionRecentRides({
			records: [ride(9, today)],
			today,
			getActivity: async () => ({ description: "" }),
			putActivity: async (id, { description }) => {
				puts.push(description);
				if (description.includes("maxeisen.me/cycling")) {
					const err = new Error("invalid");
					err.status = 400;
					throw err;
				}
			},
		});
		expect(out).toEqual({ captioned: 1, urlRejected: true });
		expect(puts[1]).toContain("Generated by the cycling dashboard");
	});
});
