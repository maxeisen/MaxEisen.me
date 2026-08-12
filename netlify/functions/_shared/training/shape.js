// Reduce a raw Strava activity to the lean, public-safe record we store.
//
// This module is the privacy boundary for /training. The page is public and the
// OAuth token carries activity:read_all, so the sync can see runs marked
// private — this is the only thing standing between those and the open web.
// It's an allow-list by construction: the output object is built field by
// field, so nothing from the raw payload can reach the public JSON unless it
// was named here. That's deliberate, since Strava adds response fields over
// time and a blocklist would quietly start leaking whatever gets added next.
//
// Specifically absent, and to stay absent:
//   - map.summary_polyline, start_latlng, end_latlng — route geometry reveals
//     home address and daily patterns. GAP is computed from gradient instead
//     (see gap.js), so nothing is lost analytically by dropping these.
//   - anything from a private activity, filtered before shaping.
//
// See shape.test.js, which asserts both of the above against a payload seeded
// with coordinates in every place Strava puts them.

import { activityGap } from "./gap.js";
import { activityLoad } from "./load.js";
import { aerobicDecoupling } from "./efficiency.js";
import { hrZoneFloors, zoneSecondsFromStreams } from "./zones.js";
import { reading } from "./num.js";
import { toDayKey } from "./dates.js";

// Foot-based sport types that belong in a marathon build. Treadmill runs count
// (VirtualRun) — the training stress is real even if the GPS isn't.
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

// Rides are tracked so the log can show what else was in the week, and for
// nothing else. They reach no metric on the page — not volume, not fitness,
// not fatigue, not the acute:chronic ratio (see metrics.js, which explains why
// the tempting middle option of counting them as fatigue alone is worse than
// either end).
const RIDE_TYPES = new Set(["Ride", "GravelRide", "MountainBikeRide", "VirtualRide"]);

// Below this a ride is transport, not training. A few kilometres to the office
// isn't context worth showing, and letting commutes through would bury the
// week's actual running under a row for every trip to the shops.
export const RIDE_MIN_M = 20000;

// Stamped onto every stored record. Several fields here are derived at sync
// time from streams we don't keep (zone seconds, decoupling, GAP), so changing
// how they're computed can't retroactively fix what's already in Blobs. Bumping
// this marks stored records stale and trainingSync re-enriches them a batch at
// a time, which is the only way those numbers ever get corrected.
//
// Bump on any change to the derived fields below or the maths behind them.
// 2: HR zone floors moved to heart-rate reserve; GAP anchored to moving time
//    and no longer thrown off by stopped time or GPS jumps.
// 3: records carry `sport`, and rides over RIDE_MIN_M are tracked.
export const SHAPE_VERSION = 3;

/**
 * Is this a public run we should track?
 *
 * @param {object} raw a Strava summary or detailed activity.
 * @returns {boolean}
 */
export function isTrackableRun(raw) {
	if (!raw || raw.private === true) return false;
	return RUN_TYPES.has(raw.sport_type || raw.type);
}

/**
 * Is this a ride long enough to have cost anything?
 *
 * @param {object} raw a Strava summary or detailed activity.
 * @returns {boolean}
 */
export function isTrackableRide(raw) {
	if (!raw || raw.private === true) return false;
	if (!RIDE_TYPES.has(raw.sport_type || raw.type)) return false;
	return (reading(raw.distance) || 0) > RIDE_MIN_M;
}

/**
 * Is this anything the dashboard tracks at all?
 *
 * @param {object} raw a Strava summary or detailed activity.
 * @returns {boolean}
 */
export function isTrackableActivity(raw) {
	return isTrackableRun(raw) || isTrackableRide(raw);
}

// What counts as a kilometre when reading splits. A run almost never ends on a
// round number, so the last split is usually a fragment whose "pace" is an
// artefact of where you happened to stop — a 40 m tail at 9:00/km is a walk to
// the door, not a collapse. Kept in storage, left out of anything that ranks or
// plots splits.
export const WHOLE_SPLIT_M = 600;

// Per-kilometre splits, keeping only what the charts and GAP need.
function shapeSplits(splits) {
	return (splits || [])
		.map((s, i) => {
			const distanceM = reading(s?.distance) || 0;
			const timeSec = reading(s?.moving_time) || 0;
			if (!(distanceM > 0) || !(timeSec > 0)) return null;
			const elevationM = reading(s?.elevation_difference) || 0;
			const gap = activityGap({
				splits: [{ distance: distanceM, moving_time: timeSec, elevation_difference: elevationM }],
			});
			return {
				km: i + 1,
				distanceM,
				timeSec,
				elevationM,
				paceSecPerKm: timeSec / (distanceM / 1000),
				gapPaceSecPerKm: gap?.gapPaceSecPerKm ?? null,
				averageHr: Number.isFinite(reading(s?.average_heartrate)) ? reading(s.average_heartrate) : null,
			};
		})
		.filter(Boolean);
}

// Strava's own PR segments over standard distances — the basis for race
// prediction. Names and times only; segment coordinates are not carried.
function shapeBestEfforts(efforts, startDateLocal) {
	return (efforts || [])
		.map((e) => {
			const distanceM = reading(e?.distance);
			const timeSec = reading(e?.elapsed_time);
			if (!(distanceM > 0) || !(timeSec > 0)) return null;
			return {
				name: String(e?.name || ""),
				distanceM,
				timeSec,
				date: toDayKey(startDateLocal),
			};
		})
		.filter(Boolean);
}

/**
 * Shape one activity into the stored record.
 *
 * @param {object} raw summary or detailed activity from Strava.
 * @param {object} [options]
 * @param {object} [options.streams] fetched streams, already keyed by type.
 * @param {object} [options.thresholds] from the plan file.
 * @param {object[]} [options.athleteZones] the athlete's configured HR zones.
 * @returns {object|null} null when the activity is private, not a run, or
 *   carries nothing measurable.
 */
export function shapeActivity(raw, options = {}) {
	const isRide = isTrackableRide(raw);
	if (!isRide && !isTrackableRun(raw)) return null;

	const { streams = null, thresholds = {}, athleteZones = null } = options;

	const distanceM = reading(raw.distance) || 0;
	const movingTimeSec = reading(raw.moving_time) || 0;
	if (!(distanceM > 0) || !(movingTimeSec > 0)) return null;

	// Pace, grade adjustment, per-kilometre splits and best efforts are all
	// foot-running measures. A bike's versions would be arithmetically valid
	// and thoroughly misleading sitting in a column beside a run's, so a ride
	// carries none of them rather than carrying numbers nobody should read.
	const splits = isRide ? [] : shapeSplits(raw.splits_metric);
	const gap = isRide
		? null
		: activityGap({
				streams,
				splits: raw.splits_metric,
				distanceM,
				movingTimeSec,
			});

	const floors = hrZoneFloors(thresholds, athleteZones);
	const zoneSeconds = floors ? zoneSecondsFromStreams(streams, floors) : null;
	const decoupling = isRide ? null : aerobicDecoupling(streams);

	const averageHr = Number.isFinite(reading(raw.average_heartrate))
		? reading(raw.average_heartrate)
		: null;

	const shaped = {
		id: raw.id,
		v: SHAPE_VERSION,
		name: String(raw.name || (isRide ? "Ride" : "Run")),
		sport: isRide ? "ride" : "run",
		type: raw.sport_type || raw.type,
		startDateLocal: raw.start_date_local || raw.start_date || null,
		distanceM,
		movingTimeSec,
		elapsedTimeSec: reading(raw.elapsed_time) || movingTimeSec,
		elevationGainM: reading(raw.total_elevation_gain) || 0,
		averageHr,
		maxHr: Number.isFinite(reading(raw.max_heartrate)) ? reading(raw.max_heartrate) : null,
		averageCadence: Number.isFinite(reading(raw.average_cadence)) ? reading(raw.average_cadence) : null,
		sufferScore: Number.isFinite(reading(raw.suffer_score)) ? reading(raw.suffer_score) : null,
		// 1 = race, 2 = long run, 3 = workout, 0/null = default.
		workoutType: Number.isFinite(reading(raw.workout_type)) ? reading(raw.workout_type) : null,
		paceSecPerKm: isRide ? null : movingTimeSec / (distanceM / 1000),
		gapPaceSecPerKm: gap?.gapPaceSecPerKm ?? null,
		gapSource: gap?.source ?? null,
		zoneSeconds,
		decouplingPct: decoupling?.decouplingPct ?? null,
		splits,
		bestEfforts: isRide
			? []
			: shapeBestEfforts(raw.best_efforts, raw.start_date_local || raw.start_date),
	};

	// A ride is stored to be listed and counted nowhere, so it's left unscored
	// rather than carrying a load that sits in the record waiting to be summed
	// by mistake. Nothing downstream reads it, and this is what makes that
	// true by construction rather than by everyone remembering.
	const load = isRide ? null : activityLoad(shaped, thresholds);
	shaped.load = load?.load ?? 0;
	shaped.loadMethod = load?.method ?? null;
	return shaped;
}

/**
 * Reduce a stored record to the fields the public run log actually renders.
 *
 * shapeActivity is the real privacy boundary, but it only guards what gets
 * *written*. Records already in Blobs were shaped by whatever version of this
 * file was deployed at the time, and they're served for as long as it takes the
 * sync to re-enrich them. This is the second allow-list, on the way out, so a
 * coordinate can't reach a public page by sitting in storage — cheap insurance
 * for the one class of leak that can't be taken back.
 *
 * Splits and best efforts are deliberately not carried: the log doesn't draw
 * them, and per-kilometre data is the most location-revealing thing left.
 *
 * @param {object} activity a stored, shaped activity.
 * @returns {object} safe to serve.
 */
export function publicRun(activity) {
	return {
		id: activity?.id,
		name: activity?.name,
		// Records written before rides were tracked have no `sport`, and every
		// one of them is a run.
		sport: activity?.sport === "ride" ? "ride" : "run",
		type: activity?.type,
		startDateLocal: activity?.startDateLocal,
		distanceM: activity?.distanceM,
		movingTimeSec: activity?.movingTimeSec,
		elevationGainM: activity?.elevationGainM,
		averageHr: activity?.averageHr,
		workoutType: activity?.workoutType,
		paceSecPerKm: activity?.paceSecPerKm,
		gapPaceSecPerKm: activity?.gapPaceSecPerKm,
	};
}

function publicZoneSeconds(zoneSeconds) {
	return Array.isArray(zoneSeconds) ? [...zoneSeconds] : null;
}

// Pace, grade adjustment and heart rate, for the kilometres that were one.
function publicSplits(splits) {
	return (splits || [])
		.filter((s) => s.distanceM >= WHOLE_SPLIT_M)
		.map((s) => ({
			km: s.km,
			paceSecPerKm: s.paceSecPerKm,
			gapPaceSecPerKm: s.gapPaceSecPerKm,
			averageHr: s.averageHr,
		}));
}

/**
 * The same, for the one run the dashboard looks at in detail.
 *
 * The log carries thirty runs and draws two numbers from each, so publicRun is
 * as narrow as that job allows. A single run being examined on its own is a
 * different trade: the sync has already computed its splits, its time in each
 * heart-rate zone, its decoupling and its load, and none of that is derivable
 * in the browser from what the log carries.
 *
 * The privacy line is the same one shape.js draws everywhere else — nothing
 * here is geographic. Per-kilometre pace, heart rate and grade adjustment
 * describe an effort, not a place, and unlike the stored splits the
 * per-kilometre elevation isn't carried: a hill profile is the one part of a
 * split list that starts to describe a route rather than a run. The total climb
 * is enough to read the pace by, and is already public on the log.
 *
 * @param {object} activity a stored, shaped activity.
 * @returns {object|null} safe to serve.
 */
export function publicLastRun(activity) {
	if (!activity) {
		return null;
	}
	return {
		...publicRun(activity),
		elapsedTimeSec: activity.elapsedTimeSec,
		maxHr: activity.maxHr,
		averageCadence: activity.averageCadence,
		load: activity.load,
		loadMethod: activity.loadMethod,
		decouplingPct: activity.decouplingPct,
		zoneSeconds: publicZoneSeconds(activity.zoneSeconds),
		splits: publicSplits(activity.splits),
	};
}

/**
 * Shape a batch, dropping everything that isn't a public run.
 *
 * @param {object[]} rawActivities
 * @param {object} [options]
 * @returns {object[]}
 */
export function shapeActivities(rawActivities, options = {}) {
	return (rawActivities || [])
		.map((raw) => shapeActivity(raw, options))
		.filter(Boolean);
}

/**
 * Every best effort across a set of shaped activities, newest first.
 *
 * @param {object[]} activities
 * @returns {object[]}
 */
export function collectBestEfforts(activities) {
	const efforts = [];
	for (const a of activities || []) {
		for (const e of a.bestEfforts || []) efforts.push(e);
	}
	return efforts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
