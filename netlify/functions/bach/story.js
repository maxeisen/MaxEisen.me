// POST /.netlify/functions/bach/story

import OpenAI from "openai";
import {
	passwordOk, jsonResponse, readBody, getSessionStore, getEnv,
	validCode, readMeta, writeMeta, keys, listJSON,
} from "./_lib.js";

function buildSystemPrompt(meta) {
	const groom = meta.groom || "the groom";
	const partner = meta.partner || "their partner";
	const extra = meta.storyTone?.trim() || "Push NSFW, crude roast-comedy hard. No moralizing.";
	const partnerBit = partner ? ` (and ${partner} where it fits)` : "";

	return `You are the official roast narrator at a bachelor party for the groom, ${groom}${partner ? `, and his fiancée ${partner}` : ""}. Perform an outrageous, filthy, hilarious story for a room of close friends.

Rules:
- Weave in EVERY single supplied word/phrase naturally or absurdly. Do not skip any. Lightly inflect if needed but keep them recognizable. Wrap each supplied word in **double asterisks**.
- The story is about ${groom}${partnerBit}. Use the couple facts to make it personal and savage.
- Tone: ${extra} No disclaimers, no breaking character.
- Do not insult or mock ${groom}'s sisters — they may be present; you can tease ${groom} about family dynamics without being cruel to them.
- 3-5 punchy paragraphs building to a ridiculous climax. Short title on the first line.
- Output only the story (title + paragraphs). No preamble.`;
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

	const wordList = submissions
		.map((s) => `- (${s.prompt}) "${s.value}" — from ${nameOf(s.playerId)}`)
		.join("\n");
	const facts = (meta.facts || "").trim();

	const userPrompt = [
		facts ? `Facts about the couple (use these to make it personal):\n${facts}\n` : "",
		`Words and phrases the guests submitted — work ALL of them in:\n${wordList}`,
	].filter(Boolean).join("\n");

	try {
		const client = new OpenAI({ apiKey });
		const model = getEnv("OPENAI_MODEL") || "gpt-4o";
		const params = {
			model,
			max_completion_tokens: 2000,
			messages: [
				{ role: "system", content: buildSystemPrompt(meta) },
				{ role: "user", content: userPrompt },
			],
		};
		if (/^(gpt-5|o\d)/.test(model)) params.reasoning_effort = "low";
		const completion = await client.chat.completions.create(params);

		const story = completion.choices?.[0]?.message?.content?.trim();
		if (!story) throw new Error("empty_completion");

		await store.set(keys.story(code, round), story);

		const fresh = (await readMeta(store, code)) || meta;
		fresh.phase = "reveal";
		fresh.error = null;
		fresh.version++;
		await writeMeta(store, code, fresh);

		return jsonResponse({ ok: true });
	} catch (err) {
		console.error("bach/story generation failed:", err?.message || err);
		const fresh = (await readMeta(store, code)) || meta;
		fresh.phase = "writing";
		fresh.error = "generation_failed";
		fresh.version++;
		await writeMeta(store, code, fresh);
		return jsonResponse({ error: "generation_failed" }, 502);
	}
}
