// POST /.netlify/functions/bach/create

import {
	passwordOk, jsonResponse, readBody, getSessionStore,
	randomCode, randomId, readMeta, writeMeta,
} from "./_lib.js";

export default async function handler(req) {
	if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	const body = await readBody(req);
	if (body === null) return jsonResponse({ error: "Invalid JSON body" }, 400);

	const facts = typeof body?.facts === "string" ? body.facts.slice(0, 4000) : "";
	const store = getSessionStore();

	let code = null;
	for (let attempt = 0; attempt < 8; attempt++) {
		const candidate = randomCode(4);
		const existing = await readMeta(store, candidate);
		if (!existing) { code = candidate; break; }
	}
	if (!code) return jsonResponse({ error: "could_not_allocate_code" }, 503);

	const hostToken = randomId();
	const meta = {
		code,
		hostToken,
		phase: "lobby",
		roundIndex: -1,
		facts,
		assignments: {},
		version: 1,
		error: null,
		leaderboard: {},
		lastMvp: null,
		createdAt: new Date().toISOString(),
	};
	await writeMeta(store, code, meta);

	return jsonResponse({ code, hostToken });
}
