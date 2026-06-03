// OpenAI image generation (fetch API — works without SDK image helpers).

import { Buffer } from "node:buffer";
import { getEnv } from "./_lib.js";

export function isStoryImagesEnabled() {
	if (getEnv("BACH_IMAGES_DISABLED") === "1") return false;
	return Boolean(getEnv("OPENAI_API_KEY")?.trim());
}

function imageConfig() {
	return {
		model: getEnv("BACH_IMAGE_MODEL") || "gpt-image-1",
		size: getEnv("BACH_IMAGE_SIZE") || "1024x1024",
		quality: getEnv("BACH_IMAGE_QUALITY") || "medium",
	};
}

async function requestImage(apiKey, body) {
	const res = await fetch("https://api.openai.com/v1/images/generations", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const msg = data?.error?.message || res.statusText;
		throw new Error(`image_gen_failed:${msg}`);
	}
	return data;
}

/** @returns {Promise<Uint8Array>} */
export async function generateFunnyImage(apiKey, prompt) {
	const { model, size, quality } = imageConfig();
	const style = [
		"Friendly cartoon editorial illustration for a comedy roast.",
		"Soft warm lighting, saturated but pleasant colors, silly and lighthearted—not scary, gross, or uncanny.",
		"Simple readable composition, exaggerated humor, no horror, no gore, no body horror, no distorted faces.",
		"No text, no logos, not photorealistic.",
	].join(" ");
	const fullPrompt = `${style} Scene: ${prompt}`.slice(0, 3200);

	const base = { model, prompt: fullPrompt, size, n: 1 };
	let data;
	try {
		data = await requestImage(apiKey, { ...base, quality });
	} catch (err) {
		// If medium fails (quota/rate), try low once—slower path than defaulting to low.
		if (quality === "medium") {
			console.warn("bach/images medium failed, retrying low:", err?.message || err);
			data = await requestImage(apiKey, { ...base, quality: "low" });
		} else {
			throw err;
		}
	}

	const b64 = data?.data?.[0]?.b64_json;
	if (b64) return Uint8Array.from(Buffer.from(b64, "base64"));

	const url = data?.data?.[0]?.url;
	if (url) {
		const img = await fetch(url);
		if (!img.ok) throw new Error("image_download_failed");
		return new Uint8Array(await img.arrayBuffer());
	}

	throw new Error("image_gen_empty");
}
