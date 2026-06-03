// POST /.netlify/functions/bach/join

import {
	passwordOk, jsonResponse, readBody, getSessionStore,
	validCode, validPlayerId, randomId, readMeta, keys,
} from "./_lib.js";

export default async function handler(req) {
	if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	const body = await readBody(req);
	if (body === null) return jsonResponse({ error: "Invalid JSON body" }, 400);

	const code = typeof body?.code === "string" ? body.code.toUpperCase() : "";
	if (!validCode(code)) return jsonResponse({ error: "invalid_code" }, 400);

	const name = (typeof body?.name === "string" ? body.name : "").trim().slice(0, 40);
	if (!name) return jsonResponse({ error: "name_required" }, 400);

	const store = getSessionStore();
	const meta = await readMeta(store, code);
	if (!meta) return jsonResponse({ error: "no_such_session" }, 404);

	// Reuse the client's id only if it's a well-formed UUID (a returning
	// player); otherwise mint a fresh one. Never let an arbitrary string reach
	// the blob key. The client persists whatever we return.
	const playerId = validPlayerId(body?.playerId) ? body.playerId : randomId();
	await store.setJSON(keys.player(code, playerId), {
		id: playerId,
		name,
		joinedAt: new Date().toISOString(),
	});

	return jsonResponse({ playerId, name });
}
