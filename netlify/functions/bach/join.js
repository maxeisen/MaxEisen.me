// POST /.netlify/functions/bach-join

import {
	withBachAuth, jsonResponse, getSessionStore,
	validPlayerId, randomId, readMeta, keys,
} from "./_lib.js";

export default async function handler(req) {
	const gate = await withBachAuth(req);
	if (gate.response) return gate.response;
	const { body, code } = gate;

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
