// Shared story → MP3 narration (used by background function).

import OpenAI from "openai";
import { getEnv, writeMeta, keys, writeStoryAudio } from "./_lib.js";
import { generateStoryAudio } from "./tts.js";

/** @returns {{ hasAudio: boolean }} */
export async function recordStoryNarration(store, code, meta, story) {
	const apiKey = getEnv("OPENAI_API_KEY");
	if (!apiKey) throw new Error("not_configured");

	const round = meta.roundIndex;
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
		meta.narrationError = null;
	} else {
		await store.delete(keys.storyAudio(code, round));
		meta.hasStoryAudio = false;
		meta.narrationError = "tts_empty";
	}

	meta.narrationPending = false;
	meta.version++;
	await writeMeta(store, code, meta);
	return { hasAudio: Boolean(audio?.byteLength) };
}
