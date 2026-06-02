// GET/POST /.netlify/functions/bach-party-pack
// Host uploads party JSON (prompt decks, names, etc.) — stored in Blobs, not env vars.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Buffer } from "node:buffer";
import {
	passwordOk, jsonResponse, readBody, getEnv, getSessionStore, keys,
} from "./_lib.js";

const MAX_BYTES = 2 * 1024 * 1024;

function validatePartyPack(raw) {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		return "invalid_shape";
	}
	const json = JSON.stringify(raw);
	if (json.length > MAX_BYTES) return "too_large";
	if (!Array.isArray(raw.pools) || raw.pools.length === 0) return "no_pools";
	for (const pool of raw.pools) {
		if (!pool || typeof pool !== "object") return "invalid_pool";
		if (!Array.isArray(pool.prompts) || pool.prompts.length === 0) return "empty_pool";
	}
	return null;
}

function loadPartyFromEnv() {
	try {
		const raw = getEnv("BACH_PARTY_JSON");
		if (raw?.trim()) return JSON.parse(raw);

		const b64 = getEnv("BACH_PARTY_JSON_BASE64");
		if (b64?.trim()) {
			return JSON.parse(Buffer.from(b64.trim(), "base64").toString("utf8"));
		}

		const path = getEnv("BACH_PARTY_JSON_PATH");
		if (path?.trim()) {
			return JSON.parse(readFileSync(resolve(path.trim()), "utf8"));
		}
	} catch (err) {
		console.warn("bach/party-pack env load failed:", err?.message || err);
	}
	return null;
}

function extractParty(body) {
	if (!body || typeof body !== "object") return null;
	if (body.party && typeof body.party === "object") return body.party;
	return body;
}

async function loadPartyFromBlob(store) {
	return store.get(keys.hostPartyPack(), { type: "json" });
}

export default async function handler(req) {
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	const store = getSessionStore();

	if (req.method === "GET") {
		try {
			const fromBlob = await loadPartyFromBlob(store);
			if (fromBlob) return jsonResponse({ party: fromBlob, source: "blob" });

			const fromEnv = loadPartyFromEnv();
			if (fromEnv) return jsonResponse({ party: fromEnv, source: "env" });

			return jsonResponse({ error: "not_configured" }, 404);
		} catch (err) {
			console.error("bach/party-pack GET failed:", err?.message || err);
			return jsonResponse({ error: "read_failed" }, 500);
		}
	}

	if (req.method === "POST") {
		const body = await readBody(req);
		if (body === null) return jsonResponse({ error: "Invalid JSON body" }, 400);

		const party = extractParty(body);
		const problem = validatePartyPack(party);
		if (problem) return jsonResponse({ error: problem }, 400);

		try {
			await store.setJSON(keys.hostPartyPack(), party, {
				metadata: { updatedAt: new Date().toISOString() },
			});
			return jsonResponse({
				ok: true,
				id: party.id || null,
				title: party.title || null,
			});
		} catch (err) {
			console.error("bach/party-pack POST failed:", err?.message || err);
			return jsonResponse({ error: "write_failed" }, 500);
		}
	}

	return jsonResponse({ error: "Method not allowed" }, 405);
}
