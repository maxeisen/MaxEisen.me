// Shared story → MP3 narration (used by background + sync triggers).

import OpenAI from "openai";
import { getEnv, keys, writeStoryAudio, writeNarrationStatus } from "./_lib.js";
import { generateStoryAudio } from "./tts.js";

/** @returns {{ hasAudio: boolean }} */
export async function recordStoryNarration(store, code, round, story) {
	const apiKey = getEnv("OPENAI_API_KEY");
	if (!apiKey) throw new Error("not_configured");

	const client = new OpenAI({ apiKey });
	const audio = await generateStoryAudio(client, story, {
		quick: !getEnv("BACH_TTS_FULL"),
		ttsModel: getEnv("BACH_TTS_MODEL"),
		ttsVoice: getEnv("BACH_TTS_VOICE"),
		ttsInstructions: getEnv("BACH_TTS_INSTRUCTIONS"),
	});

	if (audio?.byteLength) {
		await writeStoryAudio(store, code, round, audio);
		await writeNarrationStatus(store, code, round, { pending: false, error: null });
	} else {
		await store.delete(keys.storyAudio(code, round));
		await writeNarrationStatus(store, code, round, { pending: false, error: "tts_empty" });
	}
	return { hasAudio: Boolean(audio?.byteLength) };
}
