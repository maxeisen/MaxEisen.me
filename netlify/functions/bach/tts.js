// Story text → OpenAI speech (British narrator).

const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICE = "fable";
const TTS_INSTRUCTIONS =
	"Perform as a seasoned British audiobook narrator telling a bawdy after-dinner roast at a gentleman's club. " +
	"Use a refined British accent (Received Pronunciation leaning), warm and theatrical, with comic timing. " +
	"Pause briefly between paragraphs. Do not rush.";

const MAX_INPUT = 4096;

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

export async function generateStoryAudio(client, storyRaw, env = {}) {
	const input = storyTextForSpeech(storyRaw);
	if (!input) throw new Error("empty_speech_input");

	const speech = await client.audio.speech.create({
		model: env.ttsModel || TTS_MODEL,
		voice: env.ttsVoice || TTS_VOICE,
		input,
		instructions: env.ttsInstructions || TTS_INSTRUCTIONS,
		response_format: "mp3",
	});

	const buf = new Uint8Array(await speech.arrayBuffer());
	if (!buf.byteLength) throw new Error("empty_audio");
	return buf;
}
