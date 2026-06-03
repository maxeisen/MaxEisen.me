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

	const manifest = placements.map((slot) => ({
		id: slot.id,
		insertAfter: slot.insertAfter,
		caption: slot.caption,
	}));

	// Publish slots immediately so the host can show placeholders while images render.
	meta.storyImagePlacements = manifest;
	meta.hasStoryImages = false;
	meta.imagesError = null;
	meta.version++;
	await writeMeta(store, code, meta);

	const saved = [];
	for (const slot of placements) {
		try {
			const bytes = await generateFunnyImage(apiKey, slot.imagePrompt);
			await writeStoryImage(store, code, round, slot.id, bytes);
			saved.push({
				id: slot.id,
				insertAfter: slot.insertAfter,
				caption: slot.caption,
			});
		} catch (err) {
			console.warn("bach/story-images slot failed:", slot.id, err?.message || err);
		}
	}

	await store.setJSON(keys.storyImagesManifest(code, round), { placements: manifest });

	meta.storyImagePlacements = manifest;
	meta.hasStoryImages = saved.length > 0;
	meta.imagesPending = false;
	meta.imagesError = saved.length === manifest.length
		? null
		: saved.length
			? "images_partial"
			: "images_empty";
	meta.version++;
	await writeMeta(store, code, meta);
	return { hasImages: saved.length > 0, count: saved.length, planned: manifest.length };
}
