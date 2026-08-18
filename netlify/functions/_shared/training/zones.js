// Intensity zones and the easy/hard distribution.
//
// The polarised-training result that matters for a marathon build: somewhere
// around 80% of running should be genuinely easy, with the remaining 20% spent
// meaningfully hard. The classic failure is neither — a block of moderately
// uncomfortable running that accumulates fatigue without much adaptation. To
// see that happening you need time-in-zone, not run counts.
//
// Zones are anchored on lactate threshold heart rate where the plan file knows
// one, and fall back to heart-rate reserve and then percent of max. Runs with
// no heart rate at all are classified from grade-adjusted pace instead, so a
// forgotten strap doesn't quietly drop a session out of the distribution.

import { reading } from "./num.js";
import { isRecordingGap } from "./streams.js";

// Zone boundaries as fractions of lactate threshold heart rate, for zones 2
// through 5 — Friel's running zones.
//
// Threshold is the anchor to prefer whenever there is one, because it's the
// only one of the three that's measured on the athlete rather than assumed
// about them. Both fallbacks below derive the ladder from the ends of the
// range and hope the interesting boundary lands somewhere sensible in the
// middle; for a trained runner it doesn't. With a max of 195 and a resting
// rate of 47, reserve puts zone 3 at 151 — while this athlete's measured
// threshold is 175, which is 86% of reserve, in the middle of zone 4. The
// whole ladder is scaled some fifteen beats low, and the symptom is a page
// that books steady aerobic running as tempo: a rock-steady 7km at a median
// of 151bpm came out 41% easy and 59% moderate, against Strava's 97% zone 2,
// and four weeks of running read 28% easy when the honest figure is 57%.
const LTHR_FRACTIONS = [0.86, 0.9, 0.95, 1];

// Zone boundaries as fractions for the fallbacks, applied to heart-rate
// reserve when a resting HR is known (the Karvonen method), and to raw max HR
// otherwise.
//
// Reserve is the better of the two. Percent-of-max ignores resting heart rate
// entirely, so for an athlete with a low resting HR it puts the boundaries
// lower still.
const ZONE_FRACTIONS = [0.6, 0.7, 0.8, 0.9];

// Zones 1-2 are easy, 3 is the middle ground, 4-5 are hard.
const EASY_ZONES = new Set([1, 2]);
const HARD_ZONES = new Set([4, 5]);

// The share of easy running a polarised plan aims to keep above.
export const EASY_SHARE_TARGET = 80;

/**
 * Lower bounds (in bpm) for zones 1 through 5.
 *
 * Prefers a measured lactate threshold, then the athlete's own Strava zone
 * configuration, then heart-rate reserve, then percent of max HR.
 *
 * Threshold outranks the Strava configuration because Strava's zones are
 * usually nobody's decision at all — an athlete who has never opened that
 * screen still has a full set, derived from percentages of max HR, and those
 * are what the comparison above is against. The plan file's threshold is a
 * number somebody measured and wrote down.
 *
 * @param {{maxHr?: number, restingHr?: number, lactateThresholdHr?: number}} thresholds
 * @param {{min: number, max: number}[]} [athleteZones] Strava's configured zones.
 * @returns {number[]|null} five ascending bpm floors.
 */
export function hrZoneFloors(thresholds = {}, athleteZones = null) {
	const lactateThreshold = reading(thresholds.lactateThresholdHr);
	if (Number.isFinite(lactateThreshold) && lactateThreshold > 0) {
		return [0, ...LTHR_FRACTIONS.map((f) => f * lactateThreshold)];
	}

	if (Array.isArray(athleteZones) && athleteZones.length >= 5) {
		const floors = athleteZones.slice(0, 5).map((z) => reading(z?.min));
		// Must be complete AND ascending: zoneOfHr walks the ladder downward
		// and would silently misclassify every reading against a broken one.
		const usable =
			floors.every((n) => Number.isFinite(n)) &&
			floors.every((n, i) => i === 0 || n > floors[i - 1]);
		if (usable) return floors;
	}

	const max = reading(thresholds.maxHr);
	if (!Number.isFinite(max) || max <= 0) return null;

	const rest = reading(thresholds.restingHr);
	if (Number.isFinite(rest) && rest > 0 && rest < max) {
		const reserve = max - rest;
		return [0, ...ZONE_FRACTIONS.map((f) => rest + f * reserve)];
	}
	return [0, ...ZONE_FRACTIONS.map((f) => f * max)];
}

/**
 * Which zone a heart rate falls in.
 *
 * @param {number} hr
 * @param {number[]} floors
 * @returns {number|null} 1-5.
 */
export function zoneOfHr(hr, floors) {
	const bpm = reading(hr);
	// A dropped sample must not fall through to zone 1 — that would book gaps
	// in the heart-rate trace as easy running and inflate the easy share.
	if (!Number.isFinite(bpm) || bpm <= 0 || !Array.isArray(floors) || floors.length < 5) return null;
	for (let z = floors.length; z >= 1; z--) {
		if (bpm >= floors[z - 1]) return z;
	}
	return 1;
}

/**
 * Seconds spent in each zone, from paired heart-rate and time streams.
 *
 * @param {{heartrate?: number[], time?: number[]}} streams
 * @param {number[]} floors
 * @returns {number[]|null} five totals, index 0 being zone 1.
 */
export function zoneSecondsFromStreams(streams, floors) {
	const hr = streams?.heartrate;
	const time = streams?.time;
	if (!Array.isArray(hr) || !Array.isArray(time) || !Array.isArray(floors)) return null;

	const seconds = [0, 0, 0, 0, 0];
	let counted = false;
	for (let i = 1; i < hr.length && i < time.length; i++) {
		const dt = time[i] - time[i - 1];
		// A paused watch writes no samples, so the stop arrives as one long
		// interval and this loop would file all of it under the heart rate it
		// resumed at — which is a low one, standing still. Time in zone is
		// time that was recorded.
		if (!(dt > 0) || isRecordingGap(dt)) continue;
		const zone = zoneOfHr(hr[i], floors);
		if (!zone) continue;
		seconds[zone - 1] += dt;
		counted = true;
	}
	return counted ? seconds : null;
}

/**
 * Classify a whole run by grade-adjusted pace, for runs with no heart rate.
 *
 * @param {number} gapPaceSecPerKm
 * @param {{thresholdPaceSecPerKm?: number, marathonPaceSecPerKm?: number}} thresholds
 * @returns {"easy"|"moderate"|"hard"|null}
 */
export function classifyByPace(gapPaceSecPerKm, thresholds = {}) {
	const gap = Number(gapPaceSecPerKm);
	const threshold = Number(thresholds.thresholdPaceSecPerKm);
	const marathon = Number(thresholds.marathonPaceSecPerKm);
	if (!(gap > 0) || !(threshold > 0)) return null;
	if (gap <= threshold) return "hard";
	// Comfortably slower than goal-marathon pace is easy running; the band
	// between there and threshold is the moderate middle.
	const easyFloor = (marathon > 0 ? marathon : threshold * 1.09) + 20;
	return gap >= easyFloor ? "easy" : "moderate";
}

/**
 * Aggregate the easy/moderate/hard split across activities.
 *
 * Uses time-in-zone where heart rate was recorded and falls back to a
 * pace-classified whole run otherwise, so every run contributes.
 *
 * @param {{zoneSeconds?: number[], gapPaceSecPerKm?: number, movingTimeSec?: number}[]} activities
 * @param {object} thresholds
 * @returns {{easySec: number, moderateSec: number, hardSec: number, totalSec: number,
 *   easyPct: number|null, moderatePct: number|null, hardPct: number|null,
 *   zoneSeconds: number[]}}
 */
export function intensitySplit(activities, thresholds = {}) {
	const zoneSeconds = [0, 0, 0, 0, 0];
	let easySec = 0;
	let moderateSec = 0;
	let hardSec = 0;

	for (const a of activities || []) {
		const zones = a?.zoneSeconds;
		if (Array.isArray(zones) && zones.length === 5) {
			for (let i = 0; i < 5; i++) {
				const sec = Number(zones[i]) || 0;
				zoneSeconds[i] += sec;
				const zone = i + 1;
				if (EASY_ZONES.has(zone)) easySec += sec;
				else if (HARD_ZONES.has(zone)) hardSec += sec;
				else moderateSec += sec;
			}
			continue;
		}

		const sec = Number(a?.movingTimeSec) || 0;
		if (!(sec > 0)) continue;
		const band = classifyByPace(a?.gapPaceSecPerKm, thresholds);
		if (band === "easy") easySec += sec;
		else if (band === "hard") hardSec += sec;
		else if (band === "moderate") moderateSec += sec;
	}

	const totalSec = easySec + moderateSec + hardSec;
	const pct = (v) => (totalSec > 0 ? (v / totalSec) * 100 : null);
	return {
		easySec,
		moderateSec,
		hardSec,
		totalSec,
		easyPct: pct(easySec),
		moderatePct: pct(moderateSec),
		hardPct: pct(hardSec),
		zoneSeconds,
	};
}
