// GET/POST /.netlify/functions/bach-party-pack
// Library packs: live from private GitHub (PRIVATE_ACCESS_GITHUB_TOKEN), cached in Blobs.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Buffer } from "node:buffer";
import {
	passwordOk, jsonResponse, readBody, getEnv, getSessionStore, keys, validPartyPackId,
} from "./_lib.js";
import { fetchPartyPackFromGitHub, getPartyAllowlist } from "./github-pack.js";

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

function packAllowed(packId) {
	return getPartyAllowlist().includes(packId);
}

async function loadManifest(store) {
	const allowlist = getPartyAllowlist();
	const blobManifest = await store.get(keys.partyPackManifest(), { type: "json" });
	const blobList = Array.isArray(blobManifest) ? blobManifest : [];

	return allowlist.map((id) => {
		const fromBlob = blobList.find((e) => e?.id === id);
		return { id, title: fromBlob?.title || id };
	});
}

/** GitHub first, then Blobs; writes back to Blobs when GitHub succeeds. */
async function loadLibraryPack(store, packId) {
	if (!validPartyPackId(packId) || !packAllowed(packId)) return null;

	const fromGithub = await fetchPartyPackFromGitHub(packId);
	if (fromGithub && !validatePartyPack(fromGithub)) {
		await store.setJSON(keys.partyPack(packId), fromGithub, {
			metadata: { updatedAt: new Date().toISOString(), source: "github" },
		});
		return { party: fromGithub, source: "github" };
	}

	const fromBlob = await store.get(keys.partyPack(packId), { type: "json" });
	if (fromBlob && !validatePartyPack(fromBlob)) {
		return { party: fromBlob, source: "blob" };
	}

	return null;
}

function manifestWithTitle(packs, packId, title) {
	return packs.map((e) => (e.id === packId ? { ...e, title: title || e.title } : e));
}

async function resolveActivePackId(store, libraryOnly) {
	if (!libraryOnly) {
		const custom = await store.get(keys.hostPartyPack(), { type: "json" });
		if (custom) return { packId: null, source: "custom" };
	}

	const activeId = await store.get(keys.activePartyPackId(), { type: "text" });
	if (activeId && validPartyPackId(activeId) && packAllowed(activeId)) {
		return { packId: activeId, source: "library" };
	}

	const allowlist = getPartyAllowlist();
	if (allowlist.length > 0) {
		return { packId: allowlist[0], source: "library" };
	}

	return { packId: null, source: null };
}

export default async function handler(req) {
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	const store = getSessionStore();
	const url = new URL(req.url);

	if (req.method === "GET") {
		try {
			let packs = await loadManifest(store);
			const requestedId = (url.searchParams.get("pack") || "").trim();
			const libraryOnly = url.searchParams.get("library") === "1";

			if (libraryOnly && requestedId && validPartyPackId(requestedId)) {
				const loaded = await loadLibraryPack(store, requestedId);
				if (loaded) {
					packs = manifestWithTitle(packs, requestedId, loaded.party.title);
					return jsonResponse({
						packs,
						activePackId: requestedId,
						party: loaded.party,
						source: loaded.source,
					});
				}
				return jsonResponse({ packs, activePackId: requestedId, error: "pack_not_found" }, 404);
			}

			const custom = await store.get(keys.hostPartyPack(), { type: "json" });
			if (custom && !libraryOnly) {
				const activePackId = await store.get(keys.activePartyPackId(), { type: "text" });
				let party = custom;
				let source = "custom";
				if (requestedId && validPartyPackId(requestedId)) {
					const loaded = await loadLibraryPack(store, requestedId);
					if (loaded) {
						party = loaded.party;
						source = loaded.source;
					}
				}
				return jsonResponse({
					packs,
					activePackId: activePackId && validPartyPackId(activePackId) ? activePackId : null,
					party,
					source,
				});
			}

			let packId = requestedId;
			let source = "library";
			if (!packId) {
				const active = await resolveActivePackId(store, libraryOnly);
				packId = active.packId;
				source = active.source || "library";
			}

			if (packId) {
				const loaded = await loadLibraryPack(store, packId);
				if (loaded) {
					packs = manifestWithTitle(packs, packId, loaded.party.title);
					return jsonResponse({
						packs,
						activePackId: packId,
						party: loaded.party,
						source: loaded.source,
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
			const loaded = await loadLibraryPack(store, packId);
			if (!loaded) return jsonResponse({ error: "pack_not_found" }, 404);

			try {
				await store.set(keys.activePartyPackId(), packId);
				await store.delete(keys.hostPartyPack());
				return jsonResponse({
					ok: true,
					packId,
					title: loaded.party.title || packId,
					party: loaded.party,
					source: loaded.source,
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
