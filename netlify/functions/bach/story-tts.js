// POST /.netlify/functions/bach-story-tts — narration after story text exists.

import OpenAI from "openai";
import {
	passwordOk, jsonResponse, readBody, getSessionStore, getEnv,
	validCode, readMeta, writeMeta, keys, writeStoryAudio,
} from "./_lib.js";
import { generateStoryAudio } from "./tts.js";

export default async function handler(req) {
	if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	const apiKey = getEnv("OPENAI_API_KEY");
	if (!apiKey) return jsonResponse({ error: "not_configured" }, 503);

	const body = await readBody(req);
	if (body === null) return jsonResponse({ error: "Invalid JSON body" }, 400);

	const code = typeof body?.code === "string" ? body.code.toUpperCase() : "";
	if (!validCode(code)) return jsonResponse({ error: "invalid_code" }, 400);

	const store = getSessionStore();
	const meta = await readMeta(store, code);
	if (!meta) return jsonResponse({ error: "no_such_session" }, 404);

	const hostToken = typeof body?.hostToken === "string" ? body.hostToken : "";
	if (hostToken !== meta.hostToken) return jsonResponse({ error: "not_host" }, 403);

	if (meta.phase !== "reveal") return jsonResponse({ error: "bad_phase" }, 409);

	const round = meta.roundIndex;
	const story = await store.get(keys.story(code, round), { type: "text" });
	if (!story) return jsonResponse({ error: "no_story" }, 400);

	try {
		const client = new OpenAI({ apiKey });
		const audio = await generateStoryAudio(client, story, {
			quick: !getEnv("BACH_TTS_FULL"),
			ttsModel: getEnv("BACH_TTS_MODEL"),
			ttsVoice: getEnv("BACH_TTS_VOICE"),
			ttsInstructions: getEnv("BACH_TTS_INSTRUCTIONS"),
		});
		if (audio?.byteLength) {
			await writeStoryAudio(store, code, round, audio);
			meta.hasStoryAudio = true;
		} else {
			await store.delete(keys.storyAudio(code, round));
			meta.hasStoryAudio = false;
		}

		await writeMeta(store, code, meta);
		return jsonResponse({ ok: true, hasAudio: Boolean(audio?.byteLength) });
	} catch (err) {
		console.error("bach/story-tts failed:", err?.message || err);
		return jsonResponse({ error: "tts_failed" }, 502);
	}
}
