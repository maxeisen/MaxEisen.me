// Turn a woven story into a Sora-safe visual B-roll prompt (no names, no dialogue).

import { getEnv } from "./_lib.js";

const PROMPT_RULES = `Write ONE Sora 2 video prompt (2–3 sentences max).
Rules:
- Visual B-roll only: setting, lighting, camera motion, atmosphere. No on-screen text.
- No real people's names, no dialogue, no lip-sync, no identifiable faces close-up.
- Tasteful celebratory energy (bachelor/bachelorette weekend vibes), not explicit.
- Golden hour / warm documentary feel unless the setting suggests otherwise.`;

/** @param {import("openai").OpenAI} client */
export async function buildSoraPrompt(client, story, meta) {
	const model = getEnv("OPENAI_MODEL") || "gpt-4o-mini";
	const groom = meta.groom || "the guest of honour";
	const partner = meta.partner || "";
	const facts = (meta.facts || "").slice(0, 1200);
	const excerpt = story.slice(0, 1800);

	const user = [
		facts ? `Party context:\n${facts}\n` : "",
		`Celebrating ${groom}${partner ? ` and ${partner}` : ""}.`,
		`Story excerpt (mood only — do not quote or narrate):\n${excerpt}`,
	].filter(Boolean).join("\n");

	const completion = await client.chat.completions.create({
		model,
		max_completion_tokens: 300,
		messages: [
			{ role: "system", content: PROMPT_RULES },
			{ role: "user", content: user },
		],
	});

	const prompt = completion.choices?.[0]?.message?.content?.trim();
	if (!prompt) {
		return "Slow aerial drift over a sunny lake house dock at golden hour, friends laughing on the porch in soft focus, gentle camera push-in, warm cinematic documentary style, no faces in detail.";
	}
	return prompt.replace(/^["']|["']$/g, "").slice(0, 1200);
}
