// POST /.netlify/functions/bach/story

import OpenAI from "openai";
import {
	passwordOk, jsonResponse, readBody, getSessionStore, getEnv,
	validCode, readMeta, writeMeta, keys, listJSON,
} from "./_lib.js";

const SYSTEM_PROMPT = `You are the official roast narrator at a bachelor party for the groom, Matthew (sometimes with his fiancée Jane). Your job is to perform an outrageous, filthy, hilarious story for a room full of his closest friends.

Rules:
- Weave in EVERY single one of the supplied words/phrases, used naturally (or absurdly) in the story. Do not skip any. You may lightly inflect them (pluralize, conjugate) but keep them recognizable. Wrap each supplied word in **double asterisks** so it stands out when read aloud.
- The story is about Matthew (and Jane where it fits). Use the supplied facts about the couple to make it personal and savage.
- Tone: raunchy, crude, roast-style, NSFW, genuinely funny. This is a consenting adult audience that wants to be roasted. Go hard. No disclaimers, no moralizing, no breaking character.
- Keep it to 3-5 punchy paragraphs that build to a ridiculous climax. Give it a short title on the first line.
- Output only the story (title + paragraphs). No preamble, no notes.`;

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
				{ role: "system", content: SYSTEM_PROMPT },
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
