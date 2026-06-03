// POST /.netlify/functions/bach/story

import OpenAI from "openai";
import {
	passwordOk, jsonResponse, readBody, getSessionStore, getEnv,
	validCode, readMeta, writeMeta, keys, listJSON, deletePrefix,
} from "./_lib.js";

function buildSystemPrompt(meta) {
	const groom = meta.groom || "the groom";
	const partner = meta.partner || "their partner";
	const tone = meta.storyTone?.trim();
	const toneRule = tone
		? `Tone and style (from the host): ${tone}`
		: "Tone: warm, witty, and raunchy unless the host instructions below say otherwise.";
	const partnerBit = partner ? ` and ${partner}` : "";

	return `You are a skilled and witty storyteller at a group celebration for ${groom}${partnerBit}. Write a short, funny collaborative story using the guests' answers and weaving in many personal details of the couple - as though you know them.

Rules:
- You will receive each guest's answer together with the prompt they were answering. Answers are usually one word or a short phrase (a name, object, place, insult) — treat them as nouns or labels and slot them into a sentence without explaining the prompt (try to make this flow naturally). Weave every answer in grammatically; inflect for tense/plural but keep each answer recognizable. Do NOT paste answers as isolated quoted inserts, Mad-Libs non sequiturs, or "X versus Y" comparisons unless the guest literally wrote "versus".
- Do not use asterisks, bold, or any highlighting on woven words. The story should read smoothly aloud.
- Use the couple facts supplied by the host to make the story personal and hilarious.
- ${toneRule}
- 3-5 punchy paragraphs building to a fun and somewhat sentimental climax to celebrate the couple. Short title on the first line.
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

	await Promise.all([
		store.delete(keys.story(code, round)),
		store.delete(keys.storyAudio(code, round)),
		store.delete(keys.storyImagesManifest(code, round)),
		deletePrefix(store, keys.storyImagePrefix(code, round)),
	]);

	const wordList = submissions
		.map((s) => `- Prompt: ${s.prompt}\n  Answer: "${s.value}" (${nameOf(s.playerId)})`)
		.join("\n");
	const facts = (meta.facts || "").trim();

	const userPrompt = [
		facts ? `Facts about the couple (use these to make it personal):\n${facts}\n` : "",
		`Guest contributions — each answer must appear in the story, woven into full sentences that match what the prompt was asking for:\n${wordList}`,
	].filter(Boolean).join("\n");

	try {
		const client = new OpenAI({ apiKey });
		const model = getEnv("OPENAI_MODEL") || "gpt-4o-mini";
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

		const choice = completion.choices?.[0];
		const story = choice?.message?.content?.trim();
		if (!story) {
			throw new Error(`empty_completion:${choice?.finish_reason || "unknown"}`);
		}

		await store.set(keys.story(code, round), story);
		await Promise.all([
			store.delete(keys.storyAudio(code, round)),
			store.delete(keys.storyImagesManifest(code, round)),
			deletePrefix(store, keys.storyImagePrefix(code, round)),
		]);

		const fresh = (await readMeta(store, code)) || meta;
		fresh.phase = "reveal";
		fresh.error = null;
		fresh.hasStoryAudio = false;
		fresh.narrationPending = false;
		fresh.narrationError = null;
		fresh.hasStoryImages = false;
		fresh.imagesPending = false;
		fresh.imagesError = null;
		fresh.storyImagePlacements = [];
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
