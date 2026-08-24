// Tunable constants for the marathon-readiness projection.
//
// These are starting values, not a validated scientific model. They live in
// one place so later calibration against actual race results can happen
// without hunting through scoring code. Changing a weight or a curve here
// should be the whole of a calibration pass.

export const MARATHON_M = 42195;

export const MARATHON_PROJECTION = {
	weights: {
		volume: 0.3,
		longRuns: 0.25,
		decoupling: 0.15,
		consistency: 0.1,
		frequency: 0.08,
		fitnessTrend: 0.07,
		recovery: 0.05,
	},

	// adjustedSeconds = baseSeconds * (1 + k * (1 - readiness)^exponent)
	// k and exponent are conservative: excellent prep barely moves the
	// aerobic baseline; missing marathon-specific work opens a wider gap.
	penalty: {
		k: 0.22,
		exponent: 1.7,
	},

	windows: {
		longRunDays: 70,
		consistencyWeeks: 10,
		frequencyDays: 42,
		volumeFastWeeks: 4,
		volumeSlowWeeks: 8,
		peakWeeks: 10,
		peakCount: 3,
		recencyHalfLifeDays: 21,
		effortRecencyHalfLifeDays: 90,
		recoveryBaselineDays: 42,
	},

	baseline: {
		minDistanceM: 5000,
		// Longer races are stronger evidence for a marathon. A 5k still
		// counts, but it should not drown a slower half.
		distanceWeight: [
			{ minM: 21097, weight: 1 },
			{ minM: 15000, weight: 0.75 },
			{ minM: 10000, weight: 0.55 },
			{ minM: 5000, weight: 0.35 },
		],
		// If a short effort projects more than this fraction faster than the
		// longer-distance ensemble, its weight is scaled down.
		disagreementPct: 0.08,
		// A best-effort on a much longer easy or long run is a split, not a
		// race. Races and workouts (Strava workout_type 1 and 3) are kept
		// even when the session is longer than the effort (warmup/cooldown).
		splitRatio: 1.08,
		splitExtraM: 1500,
	},

	volume: {
		ewma8FloorKm: 20,
		ewma8FullKm: 70,
		ewma4FloorKm: 20,
		ewma4FullKm: 75,
		peakFloorKm: 25,
		peakFullKm: 80,
		planFloor: 0.45,
		planFull: 1,
		absoluteWeight: 0.55,
	},

	longRuns: {
		topN: 4,
		countMinM: 16000,
		over20M: 20000,
		over25M: 25000,
		over30M: 30000,
		longestFloorM: 18000,
		longestFullM: 34000,
		averageFloorM: 18000,
		averageFullM: 30000,
		countsFull: { over20: 4, over25: 3, over30: 2 },
		// GAP pace relative to predicted marathon pace that still counts as
		// "near marathon effort" rather than a race. Faster than the floor
		// is racing the long run and is not rewarded.
		nearMarathonPaceFloor: 0.97,
		nearMarathonPaceCeil: 1.1,
		paceBoost: 0.06,
	},

	decoupling: {
		minDurationSec: 75 * 60,
		excellentPct: 2,
		concernPct: 8,
	},

	consistency: {
		lowVolumePct: 50,
		cvFull: 0.12,
		cvFloor: 0.55,
		recentWeeks: 5,
		cvWeeks: 6,
	},

	frequency: {
		floor: 2,
		full: 4.5,
	},

	longRunShare: {
		cautionPct: 45,
		heavyPct: 55,
		maxPenalty: 0.08,
	},

	intensity: {
		easyFloorPct: 65,
		acwrSpike: 1.3,
		maxPenalty: 0.04,
	},

	fitness: {
		gainFloor: -8,
		gainFull: 6,
		taperDays: 21,
		acwrIdeal: 1.05,
		acwrSpread: 0.45,
	},

	recovery: {
		hrvDropPct: 15,
		rhrRiseBpm: 5,
		sleepDropPct: 12,
	},

	confidence: {
		high: 0.72,
		moderate: 0.45,
	},

	range: {
		minPct: 0.012,
		maxPct: 0.07,
		slowAsymmetry: 1.35,
	},

	raceDay: {
		plannedCredit: 0.55,
		minRemainingKm: 20,
		minDaysToRace: 8,
	},
};
