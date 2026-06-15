// Shared helpers for the /bach collaborative story game.
//
// Underscore prefix → Netlify does not deploy this as an endpoint; sibling
// handlers in this folder import it. Session state lives in the
// "bach-sessions" Blobs store. Each writer owns a distinct key so concurrent
// joins / submissions / votes never clobber each other.

import { Buffer } from "node:buffer";
import { getStore } from "@netlify/blobs";
import { getEnv } from "../_shared/env.js";
import { createJsonResponder, cacheControl } from "../_shared/http.js";

// Re-export so every bach handler keeps importing getEnv from "./_lib.js".
export { getEnv };

// Bach responses are per-viewer session state — never cached. Per-call
// extraHeaders still override, matching the old local helper's signature.
export const jsonResponse = createJsonResponder(cacheControl.none);

export function normalizePassword(pw) {
	return typeof pw === "string" ? pw.trim() : "";
}

export function passwordOk(req) {
	const expected = normalizePassword(getEnv("BACH_PASSWORD"));
	const supplied = normalizePassword(req.headers.get("x-bach-password"));
	return Boolean(expected) && supplied === expected;
}

export function getSessionStore() {
	return getStore({ name: "bach-sessions", consistency: "strong" });
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function randomCode(len = 4) {
	const bytes = new Uint8Array(len);
	globalThis.crypto.getRandomValues(bytes);
	let out = "";
	for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
	return out;
}

export function randomId() {
	return globalThis.crypto.randomUUID();
}

const CODE_RE = /^[A-Z0-9]{4}$/;
export function validCode(code) {
	return typeof code === "string" && CODE_RE.test(code);
}

// Player ids are minted with crypto.randomUUID(). Validating the shape before
// it reaches a blob key stops a caller from smuggling "/" path segments into a
// key (cross-key writes) or fabricating ids to stuff the vote tally.
const PLAYER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validPlayerId(id) {
	return typeof id === "string" && PLAYER_ID_RE.test(id);
}

export const keys = {
	meta: (code) => `${code}/meta`,
	player: (code, id) => `${code}/player/${id}`,
	playerPrefix: (code) => `${code}/player/`,
	sub: (code, round, playerId, slotId) => `${code}/sub/${round}/${playerId}/${slotId}`,
	subPrefix: (code, round) => `${code}/sub/${round}/`,
	story: (code, round) => `${code}/story/${round}`,
	storyAudio: (code, round) => `${code}/story-audio/${round}.mp3`,
	storyImage: (code, round, id) => `${code}/story-image/${round}/${id}.png`,
	storyImagesManifest: (code, round) => `${code}/story-images-manifest/${round}`,
	storyImagePrefix: (code, round) => `${code}/story-image/${round}/`,
	narrationStatus: (code, round) => `${code}/narration-status/${round}`,
	imagesStatus: (code, round) => `${code}/images-status/${round}`,
	vote: (code, round, voterId) => `${code}/vote/${round}/${voterId}`,
	votePrefix: (code, round) => `${code}/vote/${round}/`,
	/** Custom host upload override (one-off JSON). */
	hostPartyPack: () => "__host_party_pack__",
	activePartyPackId: () => "__active_party_pack_id__",
	partyPackManifest: () => "party-packs/manifest",
	partyPack: (id) => `party-packs/${id}`,
};

const PACK_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
export function validPartyPackId(id) {
	return typeof id === "string" && PACK_ID_RE.test(id);
}

export function subId(playerId, slotId) {
	return `${playerId}__${slotId}`;
}

export async function readMeta(store, code) {
	return store.get(keys.meta(code), { type: "json" });
}

export async function writeMeta(store, code, meta) {
	await store.setJSON(keys.meta(code), meta);
}

// Per-round generation status, owned by exactly one background job each, so the
// parallel narration and image jobs never clobber a shared blob.
export async function readNarrationStatus(store, code, round) {
	return store.get(keys.narrationStatus(code, round), { type: "json" });
}
export async function writeNarrationStatus(store, code, round, status) {
	await store.setJSON(keys.narrationStatus(code, round), status);
}
export async function readImagesStatus(store, code, round) {
	return store.get(keys.imagesStatus(code, round), { type: "json" });
}
export async function writeImagesStatus(store, code, round, status) {
	await store.setJSON(keys.imagesStatus(code, round), status);
}

/** @param {Uint8Array} bytes */
export async function writeStoryAudio(store, code, round, bytes) {
	const key = keys.storyAudio(code, round);
	await store.set(key, bytes);
	let verify = await readStoryAudioBytes(store, code, round);
	if (!verify?.length) {
		await store.set(key, Buffer.from(bytes).toString("base64"));
		verify = await readStoryAudioBytes(store, code, round);
	}
	if (!verify?.length) throw new Error("audio_persist_failed");
}

export async function readStoryAudioBytes(store, code, round) {
	const key = keys.storyAudio(code, round);
	try {
		const buf = await store.get(key, { type: "arrayBuffer" });
		if (buf?.byteLength) return Buffer.from(buf);
	} catch {
		/* fall through to legacy base64 */
	}
	const b64 = await store.get(key, { type: "text" });
	if (b64) return Buffer.from(b64, "base64");
	return null;
}

export async function storyAudioExists(store, code, round) {
	const bytes = await readStoryAudioBytes(store, code, round);
	return Boolean(bytes?.length);
}

/** @param {Uint8Array} bytes */
export async function writeStoryImage(store, code, round, id, bytes) {
	const key = keys.storyImage(code, round, id);
	await store.set(key, bytes);
	let verify = await readStoryImageBytes(store, code, round, id);
	if (!verify?.length) {
		await store.set(key, Buffer.from(bytes).toString("base64"));
		verify = await readStoryImageBytes(store, code, round, id);
	}
	if (!verify?.length) throw new Error("image_persist_failed");
}

export async function readStoryImageBytes(store, code, round, id) {
	const key = keys.storyImage(code, round, id);
	try {
		const buf = await store.get(key, { type: "arrayBuffer" });
		if (buf?.byteLength) return Buffer.from(buf);
	} catch {
		/* fall through */
	}
	const b64 = await store.get(key, { type: "text" });
	if (b64) return Buffer.from(b64, "base64");
	return null;
}

// Cheap readiness lookup for story images. The image blob keys ARE the
// readiness index: writeStoryImage creates `${code}/story-image/${round}/${id}.png`
// only once an image has finished and persisted, so a key's presence means that
// image is ready. Listing the prefix returns keys WITHOUT fetching bytes, so the
// hot bach-state poll does one cheap list() instead of N full image reads.
export async function listReadyImageIds(store, code, round) {
	const { blobs } = await store.list({ prefix: keys.storyImagePrefix(code, round) });
	const ids = new Set();
	for (const b of blobs) {
		const m = /\/(\d+)\.png$/.exec(b.key);
		if (m) ids.add(Number(m[1]));
	}
	return ids;
}

// Filter a placement manifest down to the ids whose image is ready, preserving
// placement order. Split out from the store read so it can be unit-tested as
// pure logic (ready id present → included; missing/invalid → skipped).
export function readyPlacementIds(placements, readySet) {
	const out = [];
	for (const slot of placements || []) {
		const id = Number(slot.id);
		if (!Number.isInteger(id) || id < 0) continue;
		if (readySet.has(id)) out.push(id);
	}
	return out;
}

export async function listJSON(store, prefix) {
	const { blobs } = await store.list({ prefix });
	// Fetch in parallel rather than awaiting each get in series (N round-trips
	// become one wave) — meaningfully faster as players/votes/subs grow.
	const entries = await Promise.all(
		blobs.map((b) => store.get(b.key, { type: "json" }).then((value) => ({ key: b.key, value }))),
	);
	return entries.filter((e) => e.value != null);
}

export async function deletePrefix(store, prefix) {
	const { blobs } = await store.list({ prefix });
	await Promise.all(blobs.map((b) => store.delete(b.key)));
}

export function shuffle(arr) {
	const next = [...arr];
	for (let i = next.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[next[i], next[j]] = [next[j], next[i]];
	}
	return next;
}

export async function readBody(req) {
	try {
		const text = await req.text();
		return text ? JSON.parse(text) : {};
	} catch {
		return null;
	}
}

// Standard POST gate shared by the authenticated bach mutation handlers
// (create/join/submit/vote/host/…): method must be POST, the BACH_PASSWORD
// header must match, the body must be valid JSON, and — unless requireCode is
// false — body.code must be a valid session code. Returns { response } holding
// the exact error to return on any failure, or { body, code } on success
// (code is "" when requireCode is false).
export async function withBachAuth(req, { requireCode = true } = {}) {
	if (req.method !== "POST") {
		return { response: jsonResponse({ error: "Method not allowed" }, 405) };
	}
	if (!passwordOk(req)) {
		return { response: jsonResponse({ error: "unauthorized" }, 401) };
	}
	const body = await readBody(req);
	if (body === null) {
		return { response: jsonResponse({ error: "Invalid JSON body" }, 400) };
	}
	if (!requireCode) {
		return { body, code: "" };
	}
	const code = typeof body?.code === "string" ? body.code.toUpperCase() : "";
	if (!validCode(code)) {
		return { response: jsonResponse({ error: "invalid_code" }, 400) };
	}
	return { body, code };
}

// The binary endpoints (story-audio, story-image) stream raw bytes and, on
// error, return a minimal JSON body carrying only Content-Type (deliberately
// not the no-store jsonResponse default). These helpers keep both handlers'
// response shapes identical.
export function binaryError(error, status) {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export function binaryResponse(bytes, contentType) {
	return new Response(bytes, {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"Cache-Control": "private, no-store",
		},
	});
}

// Shared GET gate for the binary endpoints: method must be GET, BACH_PASSWORD
// must match, code/round (and optionally id) must be valid, and the session
// must exist. Returns { response } with the matching binaryError on failure,
// or { store, code, round, id } on success (id is null when withId is false).
export async function loadBachBinary(req, { withId = false } = {}) {
	if (req.method !== "GET") return { response: binaryError("Method not allowed", 405) };
	if (!passwordOk(req)) return { response: binaryError("unauthorized", 401) };

	const url = new URL(req.url);
	const code = (url.searchParams.get("code") || "").toUpperCase();
	const round = Number(url.searchParams.get("round"));
	const id = withId ? Number(url.searchParams.get("id")) : null;

	const roundOk = Number.isInteger(round) && round >= 0;
	const idOk = !withId || (Number.isInteger(id) && id >= 0);
	if (!validCode(code) || !roundOk || !idOk) {
		return { response: binaryError("invalid_params", 400) };
	}

	const store = getSessionStore();
	const meta = await readMeta(store, code);
	if (!meta) return { response: binaryError("no_such_session", 404) };

	return { store, code, round, id };
}
