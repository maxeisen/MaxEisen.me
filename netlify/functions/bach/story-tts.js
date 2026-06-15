// POST /.netlify/functions/bach-story-tts — DEV-ONLY, not a production endpoint.
// Production (frontend + scripts/bach-audio-smoke.mjs) calls bach-story-tts-background.
// This sync path only does work locally when BACH_TTS_SYNC=1; otherwise it returns 409.

import {
	passwordOk, jsonResponse, readBody, getSessionStore, getEnv,
	validCode, readMeta, keys, readNarrationStatus, writeNarrationStatus,
} from "./_lib.js";
import { recordStoryNarration } from "./narration.js";

export default async function handler(req) {
	if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	if (!getEnv("OPENAI_API_KEY")) return jsonResponse({ error: "not_configured" }, 503);

	const body = await readBody(req);
	if (body === null) return jsonResponse({ error: "Invalid JSON body" }, 400);

	const code = typeof body?.code === "string" ? body.code.toUpperCase() : "";
	if (!validCode(code)) return jsonResponse({ error: "invalid_code" }, 400);

	const store = getSessionStore();
	const meta = await readMeta(store, code);
	if (!meta) return jsonResponse({ error: "no_such_session" }, 404);

	const hostToken = typeof body?.hostToken === "string" ? body.hostToken : "";
	if (hostToken !== meta.hostToken) return jsonResponse({ error: "not_host" }, 403);

	if (!["reveal", "voting", "results"].includes(meta.phase)) {
		return jsonResponse({ error: "bad_phase" }, 409);
	}

	const round = meta.roundIndex;
	const story = await store.get(keys.story(code, round), { type: "text" });
	if (!story) return jsonResponse({ error: "no_story" }, 400);

	// Local / smoke: run inline when explicitly requested.
	if (getEnv("BACH_TTS_SYNC") === "1") {
		const nStatus = await readNarrationStatus(store, code, round);
		if (nStatus?.pending) {
			return jsonResponse({ ok: true, accepted: true, pending: true }, 202);
		}
		await writeNarrationStatus(store, code, round, { pending: true, error: null });
		try {
			const result = await recordStoryNarration(store, code, round, story);
			return jsonResponse({ ok: true, hasAudio: result.hasAudio });
		} catch (err) {
			console.error("bach/story-tts sync failed:", err?.message || err);
			await writeNarrationStatus(store, code, round, { pending: false, error: "tts_failed" });
			return jsonResponse({ error: "tts_failed" }, 502);
		}
	}

	return jsonResponse({
		error: "use_background",
		message: "Call bach-story-tts-background instead (sync TTS exceeds function timeout).",
	}, 409);
}
