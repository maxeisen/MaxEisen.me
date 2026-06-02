// POST /.netlify/functions/bach-swap-prompt

import {
	passwordOk, jsonResponse, readBody, getSessionStore,
	validCode, readMeta, writeMeta, keys, shuffle,
} from "./_lib.js";

function pickReplacement(pool, excludePrompts) {
	const exclude = new Set(excludePrompts);
	const available = pool.filter((p) => !exclude.has(p));
	if (available.length === 0) return null;
	return shuffle(available)[0];
}

export default async function handler(req) {
	if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	const body = await readBody(req);
	if (body === null) return jsonResponse({ error: "Invalid JSON body" }, 400);

	const code = typeof body?.code === "string" ? body.code.toUpperCase() : "";
	if (!validCode(code)) return jsonResponse({ error: "invalid_code" }, 400);

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
