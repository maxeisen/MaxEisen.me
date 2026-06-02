// Story text → OpenAI speech (British narrator).

import { Buffer } from "node:buffer";

const TTS_INSTRUCTIONS =
	"British audiobook narrator, warm and witty, clear RP-ish accent, steady pace.";

const MAX_INPUT = 3200;
/** Shorter narration in quick mode → faster synthesis on Netlify's ~26s cap. */
const QUICK_MAX_INPUT = 1600;
const QUICK_TIMEOUT_MS = 18_000;
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

/** Plain text for narration: title, then body; strip markdown. */
export function storyTextForSpeech(raw, { quick = false } = {}) {
	if (!raw) return "";
	const maxLen = quick ? QUICK_MAX_INPUT : MAX_INPUT;
	const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
	const title = (lines[0] || "").replace(/^#+\s*/, "").replace(/\*\*/g, "");
	const body = lines
		.slice(1)
		.join("\n\n")
		.replace(/\*\*/g, "");
	let text = title ? `${title}.\n\n${body}` : body;
	if (text.length > maxLen) text = `${text.slice(0, maxLen - 1)}…`;
	return text;
}

async function synthesize(client, input, { model, voice, instructions, quick = false }) {
	const params = {
		model,
		voice,
		input,
		response_format: "mp3",
	};
	if (/^tts-1/.test(model)) {
		params.speed = quick ? 1.1 : 1;
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
	const input = storyTextForSpeech(storyRaw, { quick });
	if (!input) return null;

	const custom = env.ttsModel
		? [{ model: env.ttsModel, voice: env.ttsVoice || "fable", instructions: env.ttsInstructions || TTS_INSTRUCTIONS }]
		: [];
	const attempts = quick
		? (custom.length
			? custom.slice(0, 1)
			: [{ model: "tts-1", voice: env.ttsVoice || "fable" }])
		: [...custom, ...ATTEMPTS.filter((a) => !custom.some((c) => c.model === a.model))];

	let lastErr;
	for (const attempt of attempts) {
		const retries = quick ? 1 : 2;
		for (let tryNum = 0; tryNum < retries; tryNum++) {
			try {
				return await synthesize(client, input, { ...attempt, quick });
			} catch (err) {
				lastErr = err;
				console.warn(
					"bach/tts attempt failed:",
					attempt.model,
					attempt.voice,
					tryNum + 1,
					err?.message || err,
				);
				if (tryNum + 1 < retries && err?.message !== "tts_timeout") continue;
			}
		}
		if (quick) break;
	}
	console.error("bach/tts all attempts failed:", lastErr?.message || lastErr);
	return null;
}

/** Base64 for Netlify Blobs (reliable binary round-trip). */
export function audioToBlobValue(bytes) {
	return Buffer.from(bytes).toString("base64");
}
