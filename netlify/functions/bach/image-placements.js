// Plan funny illustration beats tied to specific story paragraphs.

import { getEnv } from "./_lib.js";
import { splitStoryParagraphs } from "./story-paragraphs.js";

const SYSTEM = `You plan funny editorial illustrations for a collaborative party story on a big screen.

Return JSON only: { "placements": [ { "insertAfter": number, "imagePrompt": string, "caption": string } ] }

Grounding (critical):
- insertAfter is the 0-based paragraph index AFTER which the image is shown. The image must illustrate paragraph insertAfter only—not another part of the story.
- Read that paragraph and pull concrete details (who, what action, props, setting) into imagePrompt.
- imagePrompt: one vivid scene description for an image model. Cartoon editorial roast—silly, warm, PG-13. No horror, gore, or creepy faces. No real people's names, no text in the image. Describe the single frozen moment clearly (who is where, doing what).
- caption: a short funny subtitle (max 12 words) for the host screen. It must describe the SAME moment as imagePrompt—the caption is what you'd say looking at that picture. No unrelated punchlines.
- Pick the most visual/funny beat in that paragraph. Spread placements across beginning, middle, and end. No duplicate scenes.`;

/** @param {import("openai").OpenAI} client */
export async function planStoryImagePlacements(client, story, meta) {
	const { paragraphs } = splitStoryParagraphs(story);
	const n = paragraphs.length;
	if (n < 2) return [];

	const maxImages = Math.max(1, Math.min(4, Number(getEnv("BACH_IMAGE_COUNT") || 3) || 3));
	const numbered = paragraphs.map((p, i) => `[${i}] ${p.slice(0, 400)}`).join("\n\n");

	const facts = (meta.facts || "").trim();
	const user = [
		`Plan exactly ${maxImages} illustrations for this ${n}-paragraph story.`,
		meta.groom
			? `Couple: ${meta.groom}${meta.partner ? ` and ${meta.partner}` : ""} (use "the groom" / "his partner" in prompts, not real names).`
			: "",
		facts ? `Context:\n${facts.slice(0, 1200)}` : "",
		`Each placement must be grounded in the paragraph it follows. Paragraphs:\n${numbered}`,
	].filter(Boolean).join("\n\n");

	const model = getEnv("OPENAI_MODEL") || "gpt-4o-mini";
	const completion = await client.chat.completions.create({
		model,
		max_completion_tokens: 1200,
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
		return fallbackPlacements(paragraphs, maxImages);
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
		const excerpt = paragraphs[insertAfter]?.slice(0, 400) || "";
		let caption = typeof item?.caption === "string" ? item.caption.trim().slice(0, 120) : "";
		if (!caption && excerpt) caption = excerpt.slice(0, 80).replace(/\s+/g, " ");
		out.push({
			id: out.length,
			insertAfter,
			storyExcerpt: excerpt,
			caption,
			imagePrompt: imagePrompt.slice(0, 900),
		});
	}

	return out.length ? out : fallbackPlacements(paragraphs, maxImages);
}

function fallbackPlacements(paragraphs, maxImages) {
	const n = paragraphs.length;
	const indices = [];
	const step = Math.max(1, Math.floor(n / (maxImages + 1)));
	for (let i = step - 1; i < n && indices.length < maxImages; i += step) {
		indices.push(i);
	}
	return indices.map((insertAfter, id) => {
		const excerpt = paragraphs[insertAfter]?.slice(0, 280) || "a chaotic party moment";
		return {
			id,
			insertAfter,
			storyExcerpt: excerpt,
			caption: "When the story took a hard left turn.",
			imagePrompt: `Friendly cartoon illustration of this story moment: ${excerpt}. Warm colors, silly humor, one clear scene, no text, no creepy faces.`,
		};
	});
}
