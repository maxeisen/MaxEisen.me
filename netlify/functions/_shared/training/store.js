// Netlify Blobs access for the training data.
//
// Same pattern as the bach session store: one named store, one key per concern,
// each written by a single writer so nothing clobbers anything else.
//
//   index.json  — every shaped run in the block
//   athlete.json — the athlete's configured HR zones
//   cursor.json — sync bookkeeping (last activity seen, last run time)
//   recovery.json — a night's sleep and overnight heart rate, per day
//   oura.json  — Oura's rotating OAuth tokens
//
// oura.json is the one key here that isn't a cache. Oura invalidates a refresh
// token the moment it's used, so the successor is the only way back in and
// losing it means re-authorising by hand — see _shared/oura.js.

import { getStore } from "@netlify/blobs";

export const STORE_NAME = "training";
export const INDEX_KEY = "index.json";
export const ATHLETE_KEY = "athlete.json";
export const CURSOR_KEY = "cursor.json";
export const RECOVERY_KEY = "recovery.json";
export const OURA_KEY = "oura.json";

export function getTrainingStore() {
	return getStore({ name: STORE_NAME, consistency: "strong" });
}

/**
 * Read a JSON blob, tolerating both an absent key and a corrupt one — a sync
 * half-written by a timed-out invocation shouldn't take the page down.
 *
 * @param {object} store
 * @param {string} key
 * @param {any} fallback
 * @returns {Promise<any>}
 */
export async function readJson(store, key, fallback = null) {
	try {
		const value = await store.get(key, { type: "json" });
		return value ?? fallback;
	} catch {
		return fallback;
	}
}

export async function writeJson(store, key, value) {
	await store.setJSON(key, value);
}

/**
 * Merge freshly shaped activities into the stored index, newest data winning
 * for any id already present (a re-sync of an edited activity should update it,
 * not duplicate it).
 *
 * @param {object[]} existing
 * @param {object[]} incoming
 * @returns {object[]} sorted oldest first.
 */
export function mergeActivities(existing, incoming) {
	const byId = new Map();
	for (const a of existing || []) {
		if (a?.id != null) byId.set(String(a.id), a);
	}
	for (const a of incoming || []) {
		if (a?.id == null) continue;
		const prev = byId.get(String(a.id));
		// A re-shape replaces the record. Caption metadata is owned by the
		// sync, not the shaper, so it has to survive that or every SHAPE_VERSION
		// bump would rewrite Strava.
		const next =
			prev?.captionedAt && !a.captionedAt ? { ...a, captionedAt: prev.captionedAt } : a;
		byId.set(String(a.id), next);
	}
	return [...byId.values()].sort((a, b) =>
		String(a.startDateLocal).localeCompare(String(b.startDateLocal)),
	);
}
