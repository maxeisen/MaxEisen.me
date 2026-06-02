// GET /.netlify/functions/bach-party-pack
// Returns the private party JSON (not in git). Configure one of:
//   BACH_PARTY_JSON          — raw JSON string
//   BACH_PARTY_JSON_BASE64   — base64-encoded JSON (easier for Netlify UI)
//   BACH_PARTY_JSON_PATH     — local path (netlify dev only), e.g. private/bach/matthew-jane.json

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Buffer } from "node:buffer";
import { passwordOk, jsonResponse, getEnv } from "./_lib.js";

function loadPartyFromEnv() {
	const raw = getEnv("BACH_PARTY_JSON");
	if (raw?.trim()) return JSON.parse(raw);

	const b64 = getEnv("BACH_PARTY_JSON_BASE64");
	if (b64?.trim()) {
		return JSON.parse(Buffer.from(b64.trim(), "base64").toString("utf8"));
	}

	const path = getEnv("BACH_PARTY_JSON_PATH");
	if (path?.trim()) {
		const abs = resolve(path.trim());
		return JSON.parse(readFileSync(abs, "utf8"));
	}

	return null;
}

export default async function handler(req) {
	if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	try {
		const party = loadPartyFromEnv();
		if (!party || typeof party !== "object") {
			return jsonResponse({ error: "not_configured" }, 404);
		}
		return jsonResponse({ party });
	} catch (err) {
		console.error("bach/party-pack failed:", err?.message || err);
		return jsonResponse({ error: "invalid_party_config" }, 500);
	}
}
