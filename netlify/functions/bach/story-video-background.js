// POST /.netlify/functions/bach-story-video-background

import {
	passwordOk, jsonResponse, readBody, getSessionStore, getEnv,
	validCode, readMeta, writeMeta, keys,
} from "./_lib.js";
import { recordStoryVideo } from "./video.js";
import { isSoraEnabled } from "./sora.js";

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

	if (!isSoraEnabled()) {
		return jsonResponse({ ok: true, hasVideo: false, skipped: true });
	}

	const round = meta.roundIndex;
	const story = await store.get(keys.story(code, round), { type: "text" });
	if (!story) return jsonResponse({ error: "no_story" }, 400);

	if (meta.videoPending) {
		return jsonResponse({ ok: true, accepted: true, pending: true }, 202);
	}

	meta.videoPending = true;
	meta.videoError = null;
	meta.hasStoryVideo = false;
	meta.version++;
	await writeMeta(store, code, meta);

	try {
		const result = await recordStoryVideo(store, code, meta, story);
		return jsonResponse({ ok: true, hasVideo: result.hasVideo, skipped: result.skipped });
	} catch (err) {
		console.error("bach/story-video-background failed:", err?.message || err);
		const fresh = (await readMeta(store, code)) || meta;
		fresh.videoPending = false;
		fresh.videoError = "video_failed";
		fresh.hasStoryVideo = false;
		fresh.version++;
		await writeMeta(store, code, fresh);
		return jsonResponse({ error: "video_failed", detail: err?.message || String(err) }, 500);
	}
}
