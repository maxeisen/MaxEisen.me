// POST /.netlify/functions/bach-submit

import {
	withBachAuth, jsonResponse, getSessionStore,
	readMeta, keys,
} from "./_lib.js";

export default async function handler(req) {
	const gate = await withBachAuth(req);
	if (gate.response) return gate.response;
	const { body, code } = gate;

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
