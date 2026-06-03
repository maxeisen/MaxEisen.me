// POST /.netlify/functions/bach-story-images-background

import {
	passwordOk, jsonResponse, readBody, getSessionStore, getEnv,
	validCode, readMeta, writeMeta, keys,
} from "./_lib.js";
import { recordStoryImages } from "./story-images.js";
import { isStoryImagesEnabled } from "./images.js";

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

	if (!isStoryImagesEnabled()) {
		return jsonResponse({ ok: true, hasImages: false, skipped: true });
	}

	const round = meta.roundIndex;
	const story = await store.get(keys.story(code, round), { type: "text" });
	if (!story) return jsonResponse({ error: "no_story" }, 400);

	const force = Boolean(body?.force);
	if (meta.imagesPending && !force) {
		return jsonResponse({ ok: true, accepted: true, pending: true }, 202);
	}
	if (meta.imagesPending && force) {
		meta.imagesPending = false;
	}

	meta.imagesPending = true;
	meta.imagesError = null;
	meta.version++;
	await writeMeta(store, code, meta);

	try {
		const result = await recordStoryImages(store, code, meta, story);
		return jsonResponse({ ok: true, hasImages: result.hasImages, count: result.count });
	} catch (err) {
		console.error("bach/story-images-background failed:", err?.message || err);
		const fresh = (await readMeta(store, code)) || meta;
		fresh.imagesPending = false;
		fresh.imagesError = "images_failed";
		fresh.hasStoryImages = false;
		fresh.version++;
		await writeMeta(store, code, fresh);
		return jsonResponse({ error: "images_failed" }, 500);
	}
}
