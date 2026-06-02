// POST /.netlify/functions/bach/vote

import {
	passwordOk, jsonResponse, readBody, getSessionStore,
	validCode, readMeta, keys, listJSON, subId,
} from "./_lib.js";

export default async function handler(req) {
	if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	const body = await readBody(req);
	if (body === null) return jsonResponse({ error: "Invalid JSON body" }, 400);

	const code = typeof body?.code === "string" ? body.code.toUpperCase() : "";
	if (!validCode(code)) return jsonResponse({ error: "invalid_code" }, 400);

	const voterId = typeof body?.playerId === "string" ? body.playerId : "";
	const target = typeof body?.targetSubId === "string" ? body.targetSubId : "";
	if (!voterId || !target) return jsonResponse({ error: "missing_fields" }, 400);

	const store = getSessionStore();
	const meta = await readMeta(store, code);
	if (!meta) return jsonResponse({ error: "no_such_session" }, 404);
	if (meta.phase !== "voting") return jsonResponse({ error: "not_voting" }, 409);

	const subs = await listJSON(store, keys.subPrefix(code, meta.roundIndex));
	const match = subs.find((s) => subId(s.value.playerId, s.value.slotId) === target);
	if (!match) return jsonResponse({ error: "no_such_submission" }, 400);
	if (match.value.playerId === voterId) return jsonResponse({ error: "no_self_vote" }, 403);

	await store.setJSON(keys.vote(code, meta.roundIndex, voterId), {
		voterId,
		targetSubId: target,
	});

	return jsonResponse({ ok: true });
}
