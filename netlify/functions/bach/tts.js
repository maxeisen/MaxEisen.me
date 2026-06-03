// Story text → OpenAI speech (British narrator).

import { Buffer } from "node:buffer";

const TTS_INSTRUCTIONS =
	"British audiobook narrator, warm and witty, clear RP-ish accent, steady pace.";

/** OpenAI TTS hard limit is 4096; stay slightly under. */
const TTS_CHUNK_MAX = 4000;
const QUICK_SPEED = 1.0; // natural read-along pace (the host story view scrolls in step with playback)
const QUICK_TIMEOUT_MS = 22_000;
const FULL_TIMEOUT_MS = 22_000;

/** Fastest models first; HD only as last resort. */
const ATTEMPTS = [
	{ model: "tts-1", voice: "fable" },
	{ model: "tts-1", voice: "onyx" },
	{ model: "gpt-4o-mini-tts", voice: "fable", instructions: TTS_INSTRUCTIONS },
	{ model: "tts-1-hd", voice: "fable" },
];

function withTimeout(promise, ms) {
	return Promise.race([
		promise,
		new Promise((_, reject) => {
			setTimeout(() => reject(new Error("tts_timeout")), ms);
		}),
	]);
}

/** Plain text for narration: title, then body; strip markdown (no truncation). */
export function storyTextForSpeech(raw) {
	if (!raw) return "";
	const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
	const title = (lines[0] || "").replace(/^#+\s*/, "").replace(/\*\*/g, "");
	const body = lines
		.slice(1)
		.join("\n\n")
		.replace(/\*\*/g, "");
	return title ? `${title}.\n\n${body}` : body;
}

/** Split long stories at natural breaks for multiple TTS requests. */
export function splitTextForTts(text, maxLen = TTS_CHUNK_MAX) {
	if (!text || text.length <= maxLen) return [text].filter(Boolean);
	const chunks = [];
	let rest = text;
	while (rest.length > maxLen) {
		let cut = rest.lastIndexOf("\n\n", maxLen);
		if (cut < maxLen * 0.4) cut = rest.lastIndexOf(". ", maxLen);
		if (cut < maxLen * 0.4) cut = rest.lastIndexOf(" ", maxLen);
		if (cut < 1) cut = maxLen;
		const piece = rest.slice(0, cut).trim();
		if (piece) chunks.push(piece);
		rest = rest.slice(cut).trim();
	}
	if (rest) chunks.push(rest);
	return chunks;
}

function concatMp3(parts) {
	const total = parts.reduce((n, b) => n + b.byteLength, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.byteLength;
	}
	return out;
}

async function synthesize(client, input, { model, voice, instructions, quick = false }) {
	const params = {
		model,
		voice,
		input,
		response_format: "mp3",
	};
	if (/^tts-1/.test(model)) {
		params.speed = quick ? QUICK_SPEED : 1;
	}
	if (instructions && !/^tts-1/.test(model)) {
		params.instructions = instructions;
	}
	const timeoutMs = quick ? QUICK_TIMEOUT_MS : FULL_TIMEOUT_MS;
	const speech = await withTimeout(client.audio.speech.create(params), timeoutMs);
	const buf = new Uint8Array(await speech.arrayBuffer());
	if (!buf.byteLength) throw new Error("empty_audio");
	return buf;
}

/** Returns MP3 bytes, or null if every TTS attempt fails. */
export async function generateStoryAudio(client, storyRaw, env = {}) {
	const quick = Boolean(env.quick);
	const fullText = storyTextForSpeech(storyRaw);
	if (!fullText) return null;
	const chunks = splitTextForTts(fullText);

	const custom = env.ttsModel
		? [{ model: env.ttsModel, voice: env.ttsVoice || "fable", instructions: env.ttsInstructions || TTS_INSTRUCTIONS }]
		: [];

	// Quick mode walks a short ladder (one try each) instead of a single shot,
	// so a slow/transient first call falls through to the next model/voice
	// rather than surfacing a manual retry.
	const quickLadder = [
		{ model: "tts-1", voice: env.ttsVoice || "fable" },
		{ model: "tts-1", voice: "onyx" },
		{ model: "gpt-4o-mini-tts", voice: env.ttsVoice || "fable", instructions: env.ttsInstructions || TTS_INSTRUCTIONS },
	];
	const attempts = quick
		? [...custom, ...quickLadder.filter((a) => !custom.some((c) => c.model === a.model && c.voice === a.voice))]
		: [...custom, ...ATTEMPTS.filter((a) => !custom.some((c) => c.model === a.model))];

	let lastErr;
	for (const attempt of attempts) {
		const retries = quick ? 1 : 2;
		for (let tryNum = 0; tryNum < retries; tryNum++) {
			try {
				if (chunks.length === 1) {
					return await synthesize(client, chunks[0], { ...attempt, quick });
				}
				// Synthesize chunks concurrently, then concat in order.
				const parts = await Promise.all(
					chunks.map((chunk) => synthesize(client, chunk, { ...attempt, quick })),
				);
				return concatMp3(parts);
			} catch (err) {
				lastErr = err;
				console.warn(
					"bach/tts attempt failed:",
					attempt.model,
					attempt.voice,
					tryNum + 1,
					chunks.length,
					"chunks",
					err?.message || err,
				);
				if (tryNum + 1 < retries && err?.message !== "tts_timeout") continue;
			}
		}
	}
	console.error("bach/tts all attempts failed:", lastErr?.message || lastErr);
	return null;
}

/** Base64 for Netlify Blobs (reliable binary round-trip). */
export function audioToBlobValue(bytes) {
	return Buffer.from(bytes).toString("base64");
}
