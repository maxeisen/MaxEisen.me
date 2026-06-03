// Plan funny illustration beats tied to specific story paragraphs.

import { getEnv } from "./_lib.js";
import { splitStoryParagraphs } from "./story-paragraphs.js";

const SYSTEM = `You plan funny editorial illustrations for a party story shown on a big screen.

Return JSON only: { "placements": [ { "insertAfter": number, "caption": string, "imagePrompt": string } ] }

Rules:
- insertAfter is the 0-based index of the paragraph AFTER which the image appears (0 = after first paragraph).
- Pick moments where the story is visually funny or absurd — the image should exaggerate THAT beat.
- imagePrompt: one vivid scene for an AI image generator. Cartoon editorial roast comedy—silly, warm, PG-13, genuinely funny. No horror, gore, body horror, creepy faces, or nightmare imagery. No photoreal faces, no real names, no text in image.
- caption: one short funny line for the host screen (optional subtitle).
- Do not repeat the same visual idea. Spread images through the story.`;

/** @param {import("openai").OpenAI} client */
export async function planStoryImagePlacements(client, story, meta) {
	const { paragraphs } = splitStoryParagraphs(story);
	const n = paragraphs.length;
	if (n < 2) return [];

	const maxImages = Math.max(1, Math.min(4, Number(getEnv("BACH_IMAGE_COUNT") || 3) || 3));
	const numbered = paragraphs.map((p, i) => `[${i}] ${p.slice(0, 400)}`).join("\n\n");

	const user = [
		`Write ${maxImages} placements for a ${n}-paragraph story.`,
		meta.groom ? `Celebrating ${meta.groom}${meta.partner ? ` and ${meta.partner}` : ""}.` : "",
		`Paragraphs:\n${numbered}`,
	].filter(Boolean).join("\n\n");

	const model = getEnv("OPENAI_MODEL") || "gpt-4o-mini";
	const completion = await client.chat.completions.create({
		model,
		max_completion_tokens: 800,
		response_format: { type: "json_object" },
		messages: [
			{ role: "system", content: SYSTEM },
			{ role: "user", content: user },
		],
	});

	let parsed;
	try {
		const raw = completion.choices?.[0]?.message?.content?.trim() || "{}";
		parsed = JSON.parse(raw);
	} catch {
		return fallbackPlacements(n, maxImages);
	}

	const list = Array.isArray(parsed?.placements) ? parsed.placements : [];
	const used = new Set();
	const out = [];

	for (const item of list) {
		if (out.length >= maxImages) break;
		const insertAfter = Number(item?.insertAfter);
		if (!Number.isInteger(insertAfter) || insertAfter < 0 || insertAfter >= n) continue;
		if (used.has(insertAfter)) continue;
		const imagePrompt = typeof item?.imagePrompt === "string" ? item.imagePrompt.trim() : "";
		if (!imagePrompt) continue;
		used.add(insertAfter);
		out.push({
			id: out.length,
			insertAfter,
			caption: typeof item?.caption === "string" ? item.caption.trim().slice(0, 120) : "",
			imagePrompt: imagePrompt.slice(0, 900),
		});
	}

	return out.length ? out : fallbackPlacements(n, maxImages);
}

function fallbackPlacements(paragraphCount, maxImages) {
	const indices = [];
	const step = Math.max(1, Math.floor(paragraphCount / (maxImages + 1)));
	for (let i = step - 1; i < paragraphCount && indices.length < maxImages; i += step) {
		indices.push(i);
	}
	return indices.map((insertAfter, id) => ({
		id,
		insertAfter,
		caption: "",
		imagePrompt: `Friendly cartoon illustration of a lighthearted bachelor party moment (story beat ${insertAfter + 1}). Warm colors, silly humor, wholesome roast energy—no horror or creepy faces, no text.`,
	}));
}
