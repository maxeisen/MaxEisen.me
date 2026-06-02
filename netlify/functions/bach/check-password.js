// POST /.netlify/functions/bach-check-password (via root re-export)
// Validates BACH_PASSWORD for the host/player gate UI.

import { getEnv, jsonResponse, readBody, normalizePassword } from "./_lib.js";

export default async function handler(req) {
	if (req.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	const body = await readBody(req);
	if (body === null) return jsonResponse({ error: "Invalid JSON body" }, 400);

	const expected = normalizePassword(getEnv("BACH_PASSWORD"));
	const supplied = normalizePassword(body?.password);

	if (!expected) {
		return jsonResponse({ error: "not_configured" }, 503);
	}
	if (supplied !== expected) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	return jsonResponse({ ok: true });
}
