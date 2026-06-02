// POST /.netlify/functions/bach/submit

import {
	passwordOk, jsonResponse, readBody, getSessionStore,
	validCode, readMeta, keys,
} from "./_lib.js";

export default async function handler(req) {
	if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	const body = await readBody(req);
	if (body === null) return jsonResponse({ error: "Invalid JSON body" }, 400);

	const code = typeof body?.code === "string" ? body.code.toUpperCase() : "";
	if (!validCode(code)) return jsonResponse({ error: "invalid_code" }, 400);

	const playerId = typeof body?.playerId === "string" ? body.playerId : "";
	const slotId = typeof body?.slotId === "string" ? body.slotId : "";
	const value = (typeof body?.value === "string" ? body.value : "").trim().slice(0, 120);
	if (!playerId || !slotId) return jsonResponse({ error: "missing_fields" }, 400);
	if (!value) return jsonResponse({ error: "empty_value" }, 400);

	const store = getSessionStore();
	const meta = await readMeta(store, code);
	if (!meta) return jsonResponse({ error: "no_such_session" }, 404);
	if (meta.phase !== "writing") return jsonResponse({ error: "not_writing" }, 409);

	const slots = meta.assignments?.[playerId] || [];
	const slot = slots.find((s) => s.slotId === slotId);
	if (!slot) return jsonResponse({ error: "slot_not_assigned" }, 403);

	await store.setJSON(keys.sub(code, meta.roundIndex, playerId, slotId), {
		playerId,
		slotId,
		prompt: slot.prompt,
		value,
	});

	return jsonResponse({ ok: true });
}
