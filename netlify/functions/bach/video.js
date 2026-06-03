// Sora B-roll → Blobs (muted clip; host plays with separate narration audio).

import OpenAI from "openai";
import { getEnv, writeMeta, keys, writeStoryVideo } from "./_lib.js";
import { buildSoraPrompt } from "./sora-prompt.js";
import {
	isSoraEnabled,
	createVideoJob,
	waitForVideoJob,
	downloadVideoContent,
} from "./sora.js";

/** @returns {{ hasVideo: boolean, skipped?: boolean }} */
export async function recordStoryVideo(store, code, meta, story) {
	if (!isSoraEnabled()) {
		meta.hasStoryVideo = false;
		meta.videoError = null;
		meta.videoPending = false;
		meta.version++;
		await writeMeta(store, code, meta);
		return { hasVideo: false, skipped: true };
	}

	const apiKey = getEnv("OPENAI_API_KEY");
	if (!apiKey) throw new Error("not_configured");

	const round = meta.roundIndex;
	const client = new OpenAI({ apiKey });

	const prompt = await buildSoraPrompt(client, story, meta);
	console.log("bach/sora prompt:", prompt.slice(0, 160));

	const { id: videoId } = await createVideoJob(apiKey, prompt);
	await waitForVideoJob(apiKey, videoId);
	const bytes = await downloadVideoContent(apiKey, videoId);

	await writeStoryVideo(store, code, round, bytes);
	meta.hasStoryVideo = true;
	meta.videoError = null;
	meta.soraPrompt = prompt.slice(0, 500);
	meta.videoPending = false;
	meta.version++;
	await writeMeta(store, code, meta);
	return { hasVideo: true };
}
