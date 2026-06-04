// POST /.netlify/functions/bach/story

import OpenAI from "openai";
import {
	passwordOk, jsonResponse, readBody, getSessionStore, getEnv,
	validCode, readMeta, writeMeta, keys, listJSON, deletePrefix,
	writeNarrationStatus, writeImagesStatus,
} from "./_lib.js";

function buildSystemPrompt(meta) {
	const groom = meta.groom || "the groom";
	const partner = meta.partner || "their partner";
	const tone = meta.storyTone?.trim();
	const toneRule = tone
		? `Tone and style (from the host): ${tone}`
		: "Tone: warm, witty, and raunchy unless the host instructions below say otherwise.";
	const partnerBit = partner ? ` and ${partner}` : "";

	return `You are a skilled storyteller at a celebration for ${groom}${partnerBit}. Write a real short story—not a montage of one-liners—that uses every guest contribution and the host's couple facts.

Narrative shape (required) — keep it tight, a punchy quick read, not an epic:
- Beginning (1 short paragraph): establish where we are, who's involved, and what kind of weekend or chapter this is.
- Middle (2 paragraphs): rising action—complications, roasts, and callbacks that escalate; use most guest answers here.
- End (1 short paragraph): payoff plus a warm or sentimental beat for the couple.
- First line only: a short title. Then blank line, then paragraphs.

Weaving guest answers:
- Each line pairs the question guests saw with their raw answer (usually one word or a 2–4 word phrase). Adapt grammar, tense, plurality, and capitalization so the answer reads as if it was always part of your prose—keep the answer itself recognizable. Do not quote answers in isolation, name the prompt, or do Mad Libs–style non sequiturs.
- Spread answers across the arc; do not dump them in one paragraph.
- Mark each woven-in answer by wrapping it in **double asterisks** — only the words taken from the guest's answer (after your re-grammaring), never the surrounding prose. This lets the big screen highlight the crowd's contributions. Wrap every answer you use, once each.

Style:
- ${toneRule}
- Use host couple facts for specific, funny detail.
- Keep the prose lean and quick-moving: go easy on adjectives and adverbs, never stack modifiers, and lean on strong nouns and verbs. Let the jokes and the guest answers carry it, not flowery description.
- Use **double asterisks** ONLY to mark the woven-in guest answers (above) — no headings, other markdown, or emphasis. The asterisks are stripped from the spoken narration, so it still reads smoothly aloud.
- Output only the title and story paragraphs. No preamble or notes.`;
}

export default async function handler(req) {
	if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	const apiKey = getEnv("OPENAI_API_KEY");
	if (!apiKey) return jsonResponse({ error: "not_configured" }, 503);

	const body = await readBody(req);
	if (body === null) return jsonResponse({ error: "Invalid JSON body" }, 400);

	const code = typeof body?.code === "string" ? body.code.toUpperCase() : "";
	if (!validCode(code)) return jsonResponse({ error: "invalid_code" }, 400);

	const store = getSessionStore();
	const meta = await readMeta(store, code);
	if (!meta) return jsonResponse({ error: "no_such_session" }, 404);

	const hostToken = typeof body?.hostToken === "string" ? body.hostToken : "";
	if (hostToken !== meta.hostToken) return jsonResponse({ error: "not_host" }, 403);

	const fromPhase = meta.phase;
	if (fromPhase !== "writing" && fromPhase !== "reveal") {
		return jsonResponse({ error: "bad_phase" }, 409);
	}

	const round = meta.roundIndex;
	const subBlobs = await listJSON(store, keys.subPrefix(code, round));
	const playerBlobs = await listJSON(store, keys.playerPrefix(code));
	const nameOf = (id) => playerBlobs.find((b) => b.value.id === id)?.value.name || "a guest";

	const submissions = subBlobs.map((b) => b.value).filter((s) => s.value);
	if (submissions.length === 0) return jsonResponse({ error: "no_submissions" }, 400);

	meta.phase = "generating";
	meta.error = null;
	meta.version++;
	await writeMeta(store, code, meta);

	await Promise.all([
		store.delete(keys.story(code, round)),
		store.delete(keys.storyAudio(code, round)),
		store.delete(keys.storyImagesManifest(code, round)),
		deletePrefix(store, keys.storyImagePrefix(code, round)),
		writeNarrationStatus(store, code, round, { pending: false, error: null }),
		writeImagesStatus(store, code, round, { pending: false, error: null, placements: [] }),
	]);

	const wordList = submissions
		.map((s) => `- ${nameOf(s.playerId)} — Q: ${s.prompt}\n  A: "${s.value}"`)
		.join("\n");
	const facts = (meta.facts || "").trim();

	const userPrompt = [
		facts ? `Couple facts (weave in generously):\n${facts}\n` : "",
		`Guest contributions (every answer must appear, naturally re-grammared):\n${wordList}`,
	].filter(Boolean).join("\n");

	try {
		const client = new OpenAI({ apiKey });
		const model = getEnv("OPENAI_MODEL") || "gpt-4o-mini";
		const params = {
			model,
			max_completion_tokens: 1200,
			messages: [
				{ role: "system", content: buildSystemPrompt(meta) },
				{ role: "user", content: userPrompt },
			],
		};
		if (/^(gpt-5|o\d)/.test(model)) params.reasoning_effort = "low";
		const completion = await client.chat.completions.create(params);

		const choice = completion.choices?.[0];
		const story = choice?.message?.content?.trim();
		if (!story) {
			throw new Error(`empty_completion:${choice?.finish_reason || "unknown"}`);
		}

		await store.set(keys.story(code, round), story);

		const fresh = (await readMeta(store, code)) || meta;
		fresh.phase = "reveal";
		fresh.error = null;
		fresh.version++;
		await writeMeta(store, code, fresh);

		return jsonResponse({ ok: true, hasAudio: false });
	} catch (err) {
		const detail = err?.error?.message || err?.message || String(err);
		console.error("bach/story generation failed:", detail, err?.status || "");
		const fresh = (await readMeta(store, code)) || meta;
		fresh.phase = "writing";
		fresh.error = "generation_failed";
		fresh.version++;
		await writeMeta(store, code, fresh);
		return jsonResponse({ error: "generation_failed" }, 502);
	}
}
