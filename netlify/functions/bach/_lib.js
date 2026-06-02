// Shared helpers for the /bach collaborative story game.
//
// Underscore prefix → Netlify does not deploy this as an endpoint; sibling
// handlers in this folder import it. Session state lives in the
// "bach-sessions" Blobs store. Each writer owns a distinct key so concurrent
// joins / submissions / votes never clobber each other.

import { getStore } from "@netlify/blobs";

export function getEnv(name) {
	if (typeof Netlify !== "undefined" && Netlify.env?.get) {
		return Netlify.env.get(name);
	}
	return process.env[name];
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store",
			...extraHeaders,
		},
	});
}

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

export const keys = {
	meta: (code) => `${code}/meta`,
	player: (code, id) => `${code}/player/${id}`,
	playerPrefix: (code) => `${code}/player/`,
	sub: (code, round, playerId, slotId) => `${code}/sub/${round}/${playerId}/${slotId}`,
	subPrefix: (code, round) => `${code}/sub/${round}/`,
	story: (code, round) => `${code}/story/${round}`,
	storyAudio: (code, round) => `${code}/story-audio/${round}.mp3`,
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

export async function listJSON(store, prefix) {
	const { blobs } = await store.list({ prefix });
	const out = [];
	for (const b of blobs) {
		const value = await store.get(b.key, { type: "json" });
		if (value != null) out.push({ key: b.key, value });
	}
	return out;
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
