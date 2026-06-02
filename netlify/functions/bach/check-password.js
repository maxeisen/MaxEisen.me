// POST /.netlify/functions/bach-check-password (via root re-export)
// Validates BACH_PASSWORD for the host/player gate UI.

import { getEnv, jsonResponse, readBody } from "./_lib.js";

export default async function handler(req) {
	if (req.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	const body = await readBody(req);
	if (body === null) return jsonResponse({ error: "Invalid JSON body" }, 400);

	const expected = getEnv("BACH_PASSWORD");
	const supplied = typeof body?.password === "string" ? body.password : "";

	if (!expected || supplied !== expected) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	return jsonResponse({ ok: true });
}
