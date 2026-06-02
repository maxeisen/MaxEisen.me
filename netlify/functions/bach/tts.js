// Story text → OpenAI speech (British narrator).

import { Buffer } from "node:buffer";

const TTS_INSTRUCTIONS =
	"Perform as a seasoned British audiobook narrator reading a lively group story aloud. " +
	"Use a refined British accent (Received Pronunciation leaning), warm and theatrical, with gentle comic timing. " +
	"Pause briefly between paragraphs. Do not rush.";

const MAX_INPUT = 4096;

const ATTEMPTS = [
	{ model: "gpt-4o-mini-tts", voice: "fable", instructions: TTS_INSTRUCTIONS },
	{ model: "tts-1-hd", voice: "fable" },
	{ model: "tts-1-hd", voice: "onyx" },
];

/** Plain text for narration: title, then body; strip markdown. */
export function storyTextForSpeech(raw) {
	if (!raw) return "";
	const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
	const title = (lines[0] || "").replace(/^#+\s*/, "").replace(/\*\*/g, "");
	const body = lines
		.slice(1)
		.join("\n\n")
		.replace(/\*\*/g, "");
	let text = title ? `${title}.\n\n${body}` : body;
	if (text.length > MAX_INPUT) text = `${text.slice(0, MAX_INPUT - 1)}…`;
	return text;
}

async function synthesize(client, input, { model, voice, instructions }) {
	const params = {
		model,
		voice,
		input,
		response_format: "mp3",
	};
	if (instructions && !/^tts-1/.test(model)) {
		params.instructions = instructions;
	}
	const speech = await client.audio.speech.create(params);
	const buf = new Uint8Array(await speech.arrayBuffer());
	if (!buf.byteLength) throw new Error("empty_audio");
	return buf;
}

/** Returns MP3 bytes, or null if every TTS attempt fails. */
export async function generateStoryAudio(client, storyRaw, env = {}) {
	const input = storyTextForSpeech(storyRaw);
	if (!input) return null;

	const custom = env.ttsModel
		? [{ model: env.ttsModel, voice: env.ttsVoice || "fable", instructions: env.ttsInstructions || TTS_INSTRUCTIONS }]
		: [];
	const attempts = [...custom, ...ATTEMPTS.filter((a) => !custom.some((c) => c.model === a.model))];

	let lastErr;
	for (const attempt of attempts) {
		try {
			return await synthesize(client, input, attempt);
		} catch (err) {
			lastErr = err;
			console.warn("bach/tts attempt failed:", attempt.model, attempt.voice, err?.message || err);
		}
	}
	console.error("bach/tts all attempts failed:", lastErr?.message || lastErr);
	return null;
}

/** Base64 for Netlify Blobs (reliable binary round-trip). */
export function audioToBlobValue(bytes) {
	return Buffer.from(bytes).toString("base64");
}
