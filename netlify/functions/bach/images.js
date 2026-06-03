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

/** @returns {Promise<Uint8Array>} */
export async function generateFunnyImage(apiKey, prompt) {
	const { model, size, quality } = imageConfig();
	const style = "Exaggerated funny editorial illustration, warm cinematic lighting, humorous party energy, no text, no logos, no photorealistic faces. ";
	const fullPrompt = `${style}${prompt}`.slice(0, 3200);

	const res = await fetch("https://api.openai.com/v1/images/generations", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			prompt: fullPrompt,
			size,
			quality,
			n: 1,
		}),
	});

	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const msg = data?.error?.message || res.statusText;
		throw new Error(`image_gen_failed:${msg}`);
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
