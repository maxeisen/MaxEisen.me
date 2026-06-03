// Funny story illustrations → Blobs + placement manifest.

import OpenAI from "openai";
import { getEnv, writeMeta, keys, writeStoryImage } from "./_lib.js";
import { planStoryImagePlacements } from "./image-placements.js";
import { generateFunnyImage, isStoryImagesEnabled } from "./images.js";

/** @returns {{ hasImages: boolean, skipped?: boolean, count?: number }} */
export async function recordStoryImages(store, code, meta, story) {
	if (!isStoryImagesEnabled()) {
		meta.hasStoryImages = false;
		meta.imagesPending = false;
		meta.imagesError = null;
		meta.storyImagePlacements = [];
		meta.version++;
		await writeMeta(store, code, meta);
		return { hasImages: false, skipped: true };
	}

	const apiKey = getEnv("OPENAI_API_KEY");
	if (!apiKey) throw new Error("not_configured");

	const round = meta.roundIndex;
	const client = new OpenAI({ apiKey });
	const placements = await planStoryImagePlacements(client, story, meta);

	if (!placements.length) {
		meta.hasStoryImages = false;
		meta.storyImagePlacements = [];
		meta.imagesPending = false;
		meta.imagesError = null;
		meta.version++;
		await writeMeta(store, code, meta);
		return { hasImages: false };
	}

	const results = await Promise.all(
		placements.map(async (slot) => {
			try {
				const bytes = await generateFunnyImage(apiKey, slot.imagePrompt);
				await writeStoryImage(store, code, round, slot.id, bytes);
				return {
					id: slot.id,
					insertAfter: slot.insertAfter,
					caption: slot.caption,
				};
			} catch (err) {
				console.warn("bach/story-images slot failed:", slot.id, err?.message || err);
				return null;
			}
		}),
	);
	const saved = results.filter(Boolean);

	await store.setJSON(keys.storyImagesManifest(code, round), { placements: saved });

	meta.hasStoryImages = saved.length > 0;
	meta.storyImagePlacements = saved;
	meta.imagesPending = false;
	meta.imagesError = saved.length ? null : "images_empty";
	meta.version++;
	await writeMeta(store, code, meta);
	return { hasImages: saved.length > 0, count: saved.length };
}
