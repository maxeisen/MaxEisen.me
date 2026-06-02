// GET/POST /.netlify/functions/bach-party-pack
// Library packs in Blobs (seeded on deploy); host picks by id or uploads a custom override.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Buffer } from "node:buffer";
import {
	passwordOk, jsonResponse, readBody, getEnv, getSessionStore, keys, validPartyPackId,
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

async function loadManifest(store) {
	const manifest = await store.get(keys.partyPackManifest(), { type: "json" });
	if (!Array.isArray(manifest)) return [];
	return manifest.filter((e) => e?.id && validPartyPackId(e.id));
}

async function loadLibraryPack(store, packId) {
	if (!validPartyPackId(packId)) return null;
	const manifest = await loadManifest(store);
	if (manifest.length > 0 && !manifest.some((e) => e.id === packId)) return null;
	return store.get(keys.partyPack(packId), { type: "json" });
}

async function resolveActivePackId(store) {
	const custom = await store.get(keys.hostPartyPack(), { type: "json" });
	if (custom) return { packId: null, source: "custom" };

	const activeId = await store.get(keys.activePartyPackId(), { type: "text" });
	if (activeId && validPartyPackId(activeId)) {
		return { packId: activeId, source: "library" };
	}

	const manifest = await loadManifest(store);
	if (manifest.length > 0) {
		return { packId: manifest[0].id, source: "library" };
	}

	return { packId: null, source: null };
}

export default async function handler(req) {
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	const store = getSessionStore();
	const url = new URL(req.url);

	if (req.method === "GET") {
		try {
			const packs = await loadManifest(store);
			const requestedId = (url.searchParams.get("pack") || "").trim();

			const custom = await store.get(keys.hostPartyPack(), { type: "json" });
			if (custom) {
				const activePackId = await store.get(keys.activePartyPackId(), { type: "text" });
				return jsonResponse({
					packs,
					activePackId: activePackId && validPartyPackId(activePackId) ? activePackId : null,
					party: requestedId && validPartyPackId(requestedId)
						? await loadLibraryPack(store, requestedId) || custom
						: custom,
					source: "custom",
				});
			}

			let packId = requestedId;
			let source = "library";
			if (!packId) {
				const active = await resolveActivePackId(store);
				packId = active.packId;
				source = active.source || "library";
			}

			if (packId) {
				const party = await loadLibraryPack(store, packId);
				if (party) {
					return jsonResponse({
						packs,
						activePackId: packId,
						party,
						source,
					});
				}
			}

			const fromEnv = loadPartyFromEnv();
			if (fromEnv) {
				return jsonResponse({
					packs,
					activePackId: packId || null,
					party: fromEnv,
					source: "env",
				});
			}

			return jsonResponse({ packs, activePackId: null, error: "not_configured" }, 404);
		} catch (err) {
			console.error("bach/party-pack GET failed:", err?.message || err);
			return jsonResponse({ error: "read_failed" }, 500);
		}
	}

	if (req.method === "POST") {
		const body = await readBody(req);
		if (body === null) return jsonResponse({ error: "Invalid JSON body" }, 400);

		const packId = typeof body?.packId === "string" ? body.packId.trim() : "";
		if (packId) {
			if (!validPartyPackId(packId)) return jsonResponse({ error: "invalid_pack_id" }, 400);
			const party = await loadLibraryPack(store, packId);
			if (!party) return jsonResponse({ error: "pack_not_found" }, 404);

			try {
				await store.set(keys.activePartyPackId(), packId);
				await store.delete(keys.hostPartyPack());
				return jsonResponse({
					ok: true,
					packId,
					title: party.title || packId,
					party,
					source: "library",
				});
			} catch (err) {
				console.error("bach/party-pack select failed:", err?.message || err);
				return jsonResponse({ error: "write_failed" }, 500);
			}
		}

		const party = extractParty(body);
		if (!party) return jsonResponse({ error: "missing_body" }, 400);

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
				party,
				source: "custom",
			});
		} catch (err) {
			console.error("bach/party-pack POST failed:", err?.message || err);
			return jsonResponse({ error: "write_failed" }, 500);
		}
	}

	return jsonResponse({ error: "Method not allowed" }, 405);
}
