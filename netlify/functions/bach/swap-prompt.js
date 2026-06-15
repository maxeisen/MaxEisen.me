// POST /.netlify/functions/bach-swap-prompt

import {
	withBachAuth, jsonResponse, getSessionStore,
	readMeta, writeMeta, keys, shuffle,
} from "./_lib.js";

function pickReplacement(pool, excludePrompts) {
	const exclude = new Set(excludePrompts);
	const available = pool.filter((p) => !exclude.has(p));
	if (available.length === 0) return null;
	return shuffle(available)[0];
}

export default async function handler(req) {
	const gate = await withBachAuth(req);
	if (gate.response) return gate.response;
	const { body, code } = gate;

	const playerId = typeof body?.playerId === "string" ? body.playerId : "";
	const slotId = typeof body?.slotId === "string" ? body.slotId : "";
	if (!playerId || !slotId) return jsonResponse({ error: "missing_fields" }, 400);

	const store = getSessionStore();
	const meta = await readMeta(store, code);
	if (!meta) return jsonResponse({ error: "no_such_session" }, 404);
	if (meta.phase !== "writing") return jsonResponse({ error: "not_writing" }, 409);

	const playerSlots = meta.assignments?.[playerId];
	if (!playerSlots?.length) return jsonResponse({ error: "slot_not_assigned" }, 403);

	const slot = playerSlots.find((s) => s.slotId === slotId);
	if (!slot) return jsonResponse({ error: "slot_not_assigned" }, 403);
	if (slot.swapped) return jsonResponse({ error: "already_swapped" }, 409);

	const swapPool = meta.roundSwapPool;
	if (!Array.isArray(swapPool) || swapPool.length === 0) {
		return jsonResponse({ error: "no_swap_pool" }, 503);
	}

	const exclude = playerSlots
		.filter((s) => s.slotId !== slotId)
		.map((s) => s.prompt);
	const next = pickReplacement(swapPool, exclude);
	if (!next) return jsonResponse({ error: "no_alternatives" }, 409);

	slot.prompt = next;
	slot.swapped = true;

	await store.delete(keys.sub(code, meta.roundIndex, playerId, slotId));

	meta.version++;
	await writeMeta(store, code, meta);

	return jsonResponse({ ok: true, prompt: next, slotId });
}
