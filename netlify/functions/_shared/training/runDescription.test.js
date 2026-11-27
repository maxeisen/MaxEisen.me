import { describe, it, expect } from "vitest";
import { describeRun, detectReps, isDefaultTitle, progression, retitle, shapeLaps, traceReps } from "./runDescription.js";

// A Strava lap: distance in metres, pace in seconds per km.
const lap = (distance, paceSec, extra = {}) => ({
	distance,
	moving_time: Math.round((distance / 1000) * paceSec),
	elapsed_time: Math.round((distance / 1000) * paceSec),
	...extra,
});

// Warm-up, 8 × 400m at 3:38/km with 200 m jogs of 90 s, cool-down.
function repeatLaps() {
	const laps = [lap(1500, 340)];
	for (let i = 0; i < 8; i++) {
		laps.push(lap(400, 218));
		if (i < 7) laps.push({ distance: 200, moving_time: 90, elapsed_time: 90 });
	}
	laps.push(lap(1200, 345));
	return shapeLaps(laps);
}

// Every kilometre auto-lapped at about the same pace.
const autoLaps = (count, paceSec = 335) =>
	shapeLaps(Array.from({ length: count }, (_, i) => lap(1000, paceSec + (i % 2 ? 4 : -4))));

const splits = (paces) => paces.map((p, i) => ({ km: i + 1, distanceM: 1000, paceSecPerKm: p, gapPaceSecPerKm: p }));

function run(extra = {}) {
	return {
		id: 1,
		sport: "run",
		name: "Afternoon Run",
		startDateLocal: "2026-11-25T17:41:35Z",
		distanceM: 9000,
		movingTimeSec: 2800,
		elevationGainM: 30,
		splits: [],
		zoneSeconds: null,
		...extra,
	};
}

describe("detectReps", () => {
	it("finds eight 400 m reps and the jogs between them", () => {
		const reps = detectReps(repeatLaps());
		expect(reps.label).toBe("8 × 400m");
		expect(reps.blocks).toHaveLength(8);
		expect(Math.round(reps.paceSecPerKm)).toBe(218);
		expect(reps.recoverySec).toBe(90);
	});

	it("keeps reps apart across a standing rest with no distance", () => {
		const laps = [lap(1500, 340)];
		for (let i = 0; i < 5; i++) {
			laps.push(lap(1000, 230));
			if (i < 4) laps.push({ distance: 0, moving_time: 0, elapsed_time: 120 });
		}
		laps.push(lap(1000, 345));
		const reps = detectReps(shapeLaps(laps));
		expect(reps.label).toBe("5 × 1km");
		expect(reps.recoverySec).toBe(120);
	});

	it("labels reps of the same time but different distances by time", () => {
		const laps = [lap(1500, 340)];
		for (const distance of [800, 760, 820, 700, 780, 900]) {
			laps.push({ distance, moving_time: 180, elapsed_time: 180 });
			laps.push({ distance: 300, moving_time: 120, elapsed_time: 120 });
		}
		laps.push(lap(1000, 345));
		expect(detectReps(shapeLaps(laps)).label).toBe("6 × 3 min");
	});

	it("lists blocks of different lengths in order", () => {
		const laps = shapeLaps([
			lap(1500, 340),
			lap(2000, 265),
			lap(400, 400),
			lap(1000, 260),
			lap(400, 400),
			lap(1000, 255),
			lap(1000, 345),
		]);
		expect(detectReps(laps).label).toBe("2km, 1km, 1km");
	});

	it("counts walking rests as rest, not the warm-up and cool-down as reps", () => {
		// The real 25 November session: 2 sets of 5 × 400m at 3:45/km, with
		// 90 s walks between reps and a 3 minute walk between the sets.
		const laps = [lap(1500, 340)];
		for (let set = 0; set < 2; set++) {
			for (let i = 0; i < 5; i++) {
				laps.push(lap(400, 225));
				if (i < 4) laps.push({ distance: 110, moving_time: 90, elapsed_time: 90 });
			}
			if (set === 0) laps.push({ distance: 200, moving_time: 180, elapsed_time: 180 });
		}
		laps.push(lap(1500, 345));
		const reps = detectReps(shapeLaps(laps));
		expect(reps.label).toBe("10 × 400m");
		expect(reps.sets).toMatchObject({ count: 2, perSet: 5 });
		expect(reps.recoverySec).toBe(90);
		expect(Math.round(reps.paceSecPerKm)).toBe(225);

		const out = describeRun(run(), {
			match: { planned: true, type: "intervals", detail: "400m Repeats", distanceKm: 9 },
			laps: shapeLaps(laps),
		});
		expect(out.title).toBe("10 × 400m Repeats");
		expect(out.summary).toContain("10 × 400m in 2 sets of 5 at an average of 3:45/km, with about 1:30 between reps.");
	});

	it("does not call reps with even rests sets", () => {
		expect(detectReps(repeatLaps()).sets).toBeNull();
	});

	it("reads evenly paced auto-laps as no workout", () => {
		expect(detectReps(autoLaps(8))).toBeNull();
	});

	it("does not call a fast last kilometre a tempo block", () => {
		const laps = shapeLaps([...autoLaps(6).map((l) => ({ distance: l.distanceM, moving_time: l.movingTimeSec })), lap(1000, 270)]);
		expect(detectReps(laps)).toBeNull();
	});

	it("reads one long fast block with easy running either side as a tempo", () => {
		const laps = shapeLaps([lap(2000, 340), lap(4000, 262), lap(2000, 345)]);
		expect(detectReps(laps).label).toBe("4km");
	});
});

describe("progression", () => {
	it("is how much faster the last third was than the first", () => {
		expect(progression(splits([340, 340, 335, 330, 325, 325]))).toBe(15);
	});

	it("is null on a run too short to have thirds", () => {
		expect(progression(splits([340, 330, 320]))).toBeNull();
	});
});

describe("describeRun", () => {
	it("names a planned repeats session by its reps and says how they went", () => {
		const out = describeRun(run(), {
			match: { planned: true, type: "intervals", detail: "400m Repeats", distanceKm: 7.5 },
			laps: repeatLaps(),
		});
		expect(out.kind).toBe("intervals");
		expect(out.title).toBe("8 × 400m Repeats");
		expect(out.summary).toBe(
			"Planned session: 400m Repeats (7.5 km). Ran 9.0 km, more than the 7.5 km planned. " +
				"8 × 400m at an average of 3:38/km, with about 1:30 between reps.",
		);
	});

	it("puts the distance run in a planned easy run's title and says it was kept easy", () => {
		const out = describeRun(run({ distanceM: 6020, zoneSeconds: [1200, 800, 150, 50, 0] }), {
			match: { planned: true, type: "easy run", detail: "6km Easy Run", distanceKm: 6 },
			laps: autoLaps(6),
		});
		expect(out.title).toBe("6km Easy Run");
		expect(out.summary).toBe("Planned session: 6km Easy Run (6 km). Kept easy: 91% of the time in the easy heart-rate zones.");
	});

	it("says when a planned easy run was run hard", () => {
		const out = describeRun(run({ distanceM: 6000, zoneSeconds: [200, 400, 600, 600, 200] }), {
			match: { planned: true, type: "easy run", detail: "6km Easy Run", distanceKm: 6 },
		});
		expect(out.summary).toContain("Harder than an easy run: only 30% of the time in the easy heart-rate zones.");
	});

	it("says which day a moved session was planned for", () => {
		const out = describeRun(run({ distanceM: 7600, startDateLocal: "2026-11-21T16:45:40Z" }), {
			match: { planned: true, type: "tempo", detail: "Tempo 2-1-1", distanceKm: 7, movedFrom: "2026-11-20" },
		});
		expect(out.title).toBe("Tempo 2-1-1");
		expect(out.summary).toBe("Planned session: Tempo 2-1-1 (7 km), moved from Friday.");
	});

	it("drops Runna's time estimate from the title", () => {
		const out = describeRun(run(), { match: { planned: true, type: "long run", detail: "Long Run (~95m)" } });
		expect(out.title).toBe("Long Run");
	});

	it("calls an unplanned run that picked up a progressive run", () => {
		const out = describeRun(run({ distanceM: 10000, splits: splits([340, 340, 338, 335, 332, 330, 328, 325, 322, 320]) }));
		expect(out.kind).toBe("progressive");
		expect(out.title).toBe("10km Progressive Run");
		expect(out.summary).toBe("Not on the plan: a progressive run. Picked up through the run: the last third was 17 s/km faster than the first.");
	});

	it("calls an unplanned workout what its laps show", () => {
		const out = describeRun(run(), { laps: repeatLaps() });
		expect(out.title).toBe("8 × 400m Repeats");
		expect(out.summary).toBe("Not on the plan: an interval session. 8 × 400m at an average of 3:38/km, with about 1:30 between reps.");
	});

	it("calls a hilly unplanned run hilly", () => {
		const out = describeRun(run({ distanceM: 8000, elevationGainM: 160 }));
		expect(out.title).toBe("8km Hilly Easy Run");
		expect(out.summary).toContain("Hilly, with 160 m of climbing.");
	});

	it("calls a run well past the recent normal a long run", () => {
		const earlier = ["2026-11-10", "2026-11-14", "2026-11-18", "2026-11-20"].map((day, i) => ({
			id: 100 + i,
			sport: "run",
			startDateLocal: `${day}T07:00:00Z`,
			distanceM: 7000,
		}));
		const target = run({ distanceM: 16000 });
		const out = describeRun(target, { runs: [...earlier, target] });
		expect(out.kind).toBe("long run");
		expect(out.title).toBe("16km Long Run");
	});
});

describe("titles", () => {
	it("knows Strava's default titles", () => {
		for (const name of ["Morning Run", "Lunch Run", "Afternoon Run", "Evening Run", "Night Run", "Morning Trail Run"]) {
			expect(isDefaultTitle(name)).toBe(true);
		}
		expect(isDefaultTitle("Tempo with the club")).toBe(false);
		expect(isDefaultTitle("Morning Run 🌅")).toBe(false);
	});

	it("only replaces a default title, and only with something different", () => {
		expect(retitle("Afternoon Run", "6km Easy Run")).toBe("6km Easy Run");
		expect(retitle("Easy shakeout", "6km Easy Run")).toBeNull();
		expect(retitle("Afternoon Run", "")).toBeNull();
	});

	it("also replaces a title it wrote, or the plan's bare name, but not the athlete's", () => {
		expect(retitle("400m Repeats", "10 × 400m Repeats", ["400m Repeats"])).toBe("10 × 400m Repeats");
		expect(retitle("Track night", "10 × 400m Repeats", ["400m Repeats"])).toBeNull();
	});

	it("gives the plan's bare name for a planned run", () => {
		const match = { planned: true, type: "intervals", detail: "400m Repeats", target: { reps: 8, distanceM: 400, paceSecPerKm: [215, 215] } };
		expect(describeRun(run(), { match, laps: repeatLaps() }).planName).toBe("400m Repeats");
		expect(describeRun(run()).planName).toBeNull();
	});
});

describe("describeRun with the plan's rep target", () => {
	const match = {
		planned: true,
		type: "intervals",
		detail: "400m Repeats",
		distanceKm: 9,
		target: { reps: 8, distanceM: 400, paceSecPerKm: [215, 215] },
	};

	it("says what the plan asked for beside what the laps show", () => {
		const out = describeRun(run(), { match, laps: repeatLaps() });
		expect(out.summary).toBe(
			"Planned session: 400m Repeats (9 km), 8 × 400m at 3:35/km. " +
				"8 × 400m at an average of 3:38/km, with about 1:30 between reps.",
		);
	});

	it("gives a pace range as a range", () => {
		const out = describeRun(run(), {
			match: { ...match, target: { reps: 5, distanceM: 1000, paceSecPerKm: [250, 260] } },
		});
		expect(out.summary).toContain("5 × 1km at 4:10–4:20/km");
	});

	it("takes the rep count for the title from the plan when the laps don't show reps", () => {
		expect(describeRun(run(), { match, laps: autoLaps(9) }).title).toBe("8 × 400m Repeats");
	});
});

// Pace samples (s/km, about every 150 m) from two real runs: the 25 November
// session of 2 sets of 5 × 400m at 3:45/km, and the hilly 22 November long run.
const REPS_TRACE = [329, 309, 302, 325, 316, 329, 347, 321, 312, 305, 311, 297, 307, 509, 327, 230, 224, 449, 231, 232, 427, 259, 233, 283, 381, 225, 220, 461, 220, 222, 419, 522, 220, 228, 419, 273, 219, 241, 448, 212, 214, 449, 219, 215, 350, 349, 212, 227, 635, 388, 301, 314, 331, 272, 317, 315, 327, 321, 305, 333];
const HILLY_TRACE = [389, 279, 314, 305, 315, 319, 279, 295, 308, 322, 320, 296, 301, 322, 364, 303, 322, 307, 317, 319, 303, 310, 312, 326, 340, 451, 506, 484, 570, 410, 331, 346, 346, 317, 324, 335, 321, 307, 317, 306, 327, 306, 319, 322, 318, 371, 305, 312, 312, 289, 297, 295, 309, 303, 322, 305, 320, 362, 285, 288, 284, 288, 295, 288, 288, 295];

describe("reps from the pace trace", () => {
	it("counts the 25 November reps and averages their pace", () => {
		const reps = traceReps({ pace: REPS_TRACE }, 400);
		expect(reps.label).toBe("10 × 400m");
		expect(Math.round(reps.paceSecPerKm / 5) * 5).toBe(225);
		expect(reps.fromTrace).toBe(true);
	});

	it("finds no reps in a hilly long run", () => {
		expect(traceReps({ pace: HILLY_TRACE })).toBeNull();
	});

	it("names the reps from the plan when the laps are plain 1 km auto-laps", () => {
		const out = describeRun(run({ trace: { pace: REPS_TRACE } }), {
			match: { planned: true, type: "intervals", detail: "400m Repeats", distanceKm: 9 },
			laps: autoLaps(9),
		});
		expect(out.title).toBe("10 × 400m Repeats");
		expect(out.summary).toContain("10 × 400m at an average of about 3:4");
	});

	it("counts reps without a distance when the plan names none", () => {
		const out = describeRun(run({ distanceM: 9000, trace: { pace: REPS_TRACE } }));
		expect(out.title).toBe("9km Intervals");
		expect(out.summary).toMatch(/^Not on the plan: an interval session\. 10 reps at an average of about 3:4\d\/km\.$/);
	});
});

describe("auto-laps", () => {
	it("reads nothing into 1 km auto-laps, even with slow hilly kilometres among them", () => {
		const laps = shapeLaps([340, 310, 420, 300, 305, 430, 300, 295, 290, 330].map((p) => lap(1000, p)).concat([lap(400, 300)]));
		expect(detectReps(laps)).toBeNull();
	});
});
