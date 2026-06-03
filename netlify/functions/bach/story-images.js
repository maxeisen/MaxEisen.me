// Funny story illustrations → Blobs + placement manifest.

import OpenAI from "openai";
import { getEnv, keys, writeStoryImage, writeImagesStatus } from "./_lib.js";
import { planStoryImagePlacements } from "./image-placements.js";
import { generateFunnyImage, isStoryImagesEnabled } from "./images.js";

/** @returns {{ hasImages: boolean, skipped?: boolean, count?: number, planned?: number }} */
export async function recordStoryImages(store, code, round, story, meta) {
	if (!isStoryImagesEnabled()) {
		await writeImagesStatus(store, code, round, { pending: false, error: null, placements: [] });
		return { hasImages: false, skipped: true };
	}

	const apiKey = getEnv("OPENAI_API_KEY");
	if (!apiKey) throw new Error("not_configured");

	const client = new OpenAI({ apiKey });
	const placements = await planStoryImagePlacements(client, story, meta);
	const manifest = placements.map((slot) => ({
		id: slot.id,
		insertAfter: slot.insertAfter,
		caption: slot.caption,
	}));

	// Publish slots immediately so the host can show placeholders while images render.
	await writeImagesStatus(store, code, round, { pending: true, error: null, placements: manifest });

	const saved = [];
	async function saveSlot(slot) {
		const bytes = await generateFunnyImage(apiKey, slot);
		await writeStoryImage(store, code, round, slot.id, bytes);
		saved.push({ id: slot.id, insertAfter: slot.insertAfter, caption: slot.caption });
	}

	// Generate all slots concurrently, then retry any failures once (also concurrent).
	const ok = await Promise.all(placements.map((slot) =>
		saveSlot(slot).then(() => true, (err) => {
			console.warn("bach/story-images slot failed:", slot.id, err?.message || err);
			return false;
		})));
	const failed = placements.filter((_, i) => !ok[i]);
	if (failed.length) {
		await Promise.all(failed.map((slot) =>
			saveSlot(slot).then(() => true, (err) => {
				console.warn("bach/story-images slot retry failed:", slot.id, err?.message || err);
				return false;
			})));
	}

	await store.setJSON(keys.storyImagesManifest(code, round), { placements: manifest });

	const error = saved.length === manifest.length
		? null
		: saved.length
			? "images_partial"
			: "images_empty";
	await writeImagesStatus(store, code, round, { pending: false, error, placements: manifest });
	return { hasImages: saved.length > 0, count: saved.length, planned: manifest.length };
}
