// The live training plan, when there is one.
//
// With RUNNA_ICS_URL set, the weeks come from Runna's calendar feed (synced
// into Blobs by trainingSync — see runna.js and loadTrainingPlan below) and
// this file only needs `race` overrides and `thresholds`.
//
// Named plans live in public/content/running/. The dashboard only reads
// current-plan.json from that directory — copy or rename a plan to that name
// to put a block on /running. A missing, unreadable or empty file is the
// no-block running log, not a deploy failure.
//
// Read from disk rather than imported as JSON. A static import is inlined by
// esbuild, which is why this used to work, but it also makes a missing file a
// failed bundle — and between blocks there is no current-plan.json.
// process.cwd() is the site root in vitest and (with included_files) in the
// function zip. import.meta.url fallbacks cover a bundled function whose cwd
// isn't the zip root; they used to be the only lookup and silently missed
// the file under `netlify dev` because the bundle is emitted to a temp
// directory, so cwd is tried first.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toPlanWeeks } from "./runna.js";
import { RUNNA_PLAN_KEY, getTrainingStore, readJson } from "./store.js";

const REL = "public/content/running/current-plan.json";

function normalizePlan(json) {
	if (!json || typeof json !== "object" || Array.isArray(json)) {
		return { race: {}, thresholds: {}, weeks: [] };
	}
	return {
		race: json.race && typeof json.race === "object" && !Array.isArray(json.race) ? json.race : {},
		thresholds: json.thresholds && typeof json.thresholds === "object" && !Array.isArray(json.thresholds) ? json.thresholds : {},
		weeks: Array.isArray(json.weeks) ? json.weeks : [],
	};
}

function readPlan(path) {
	try {
		return normalizePlan(JSON.parse(readFileSync(path, "utf8")));
	} catch {
		return null;
	}
}

function bundledCandidates() {
	const here = dirname(fileURLToPath(import.meta.url));
	return [
		join(process.cwd(), REL),
		resolve(here, "../../../../", REL),
		resolve(here, "../../../", REL),
		join(here, REL),
	];
}

/**
 * @param {string} [root] site root containing public/content/running/.
 *   Omitted in production so bundled functions can also try paths relative
 *   to the emitted file. Tests pass a temp root to isolate the lookup.
 * @returns {{race: object, thresholds: object, weeks: object[]}}
 */
export function loadPlan(root) {
	const paths = root != null ? [join(root, REL)] : bundledCandidates();
	for (const path of paths) {
		const plan = readPlan(path);
		if (plan) return plan;
	}
	return normalizePlan(null);
}

/**
 * The plan file and the Runna feed, as one plan.
 *
 * With a feed configured, its sessions are the weeks: Runna is where the plan
 * gets changed, and a file kept in step by hand would only ever be behind it.
 * The file still supplies what the feed can't — thresholds, and race fields
 * such as a goal time or label — and wins on any race field it sets, unless
 * it describes a different race (a file left over from the last block).
 *
 * @param {{race: object, thresholds: object, weeks: object[]}} filePlan
 * @param {{sessions?: object[], race?: object|null}|null} runna stored feed state
 */
export function combinePlans(filePlan, runna) {
	if (!Array.isArray(runna?.sessions) || runna.sessions.length === 0) return filePlan;
	const feedRace = runna.race || {};
	const fileRace = filePlan.race || {};
	const sameRace = !fileRace.date || !feedRace.date || fileRace.date === feedRace.date;
	return {
		race: sameRace ? { ...feedRace, ...fileRace } : { ...feedRace },
		thresholds: filePlan.thresholds,
		weeks: toPlanWeeks(runna.sessions),
	};
}

/**
 * The live plan: the file, overlaid with the last Runna feed sync if there is
 * one. A missing or unreadable blob is the file alone.
 *
 * @param {object} [store]
 */
export async function loadTrainingPlan(store = getTrainingStore()) {
	const runna = await readJson(store, RUNNA_PLAN_KEY, null);
	return combinePlans(loadPlan(), runna);
}
