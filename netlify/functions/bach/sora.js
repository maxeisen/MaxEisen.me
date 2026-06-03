// OpenAI Sora 2 Videos API — create, poll, download.

import { getEnv } from "./_lib.js";

const API = "https://api.openai.com/v1/videos";

export function isSoraEnabled() {
	if (getEnv("BACH_SORA_DISABLED") === "1") return false;
	return Boolean(getEnv("OPENAI_API_KEY")?.trim());
}

function soraConfig() {
	return {
		model: getEnv("BACH_SORA_MODEL") || "sora-2",
		size: getEnv("BACH_SORA_SIZE") || "1280x720",
		seconds: String(getEnv("BACH_SORA_SECONDS") || "12"),
	};
}

async function openaiFetch(apiKey, path, { method = "GET", body } = {}) {
	const headers = { Authorization: `Bearer ${apiKey}` };
	let payload = body;
	if (body && !(body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
		payload = JSON.stringify(body);
	}
	const res = await fetch(`${API}${path}`, { method, headers, body: payload });
	return res;
}

/** @returns {Promise<{ id: string, status: string }>} */
export async function createVideoJob(apiKey, prompt) {
	const { model, size, seconds } = soraConfig();
	const form = new FormData();
	form.append("model", model);
	form.append("prompt", prompt);
	form.append("size", size);
	form.append("seconds", seconds);

	const res = await openaiFetch(apiKey, "", { method: "POST", body: form });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const msg = data?.error?.message || data?.error || res.statusText;
		throw new Error(`sora_create_failed:${msg}`);
	}
	if (!data?.id) throw new Error("sora_create_failed:no_id");
	return { id: data.id, status: data.status || "queued" };
}

/** @returns {Promise<{ status: string, error?: object }>} */
export async function getVideoJob(apiKey, videoId) {
	const res = await openaiFetch(apiKey, `/${encodeURIComponent(videoId)}`);
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const msg = data?.error?.message || res.statusText;
		throw new Error(`sora_status_failed:${msg}`);
	}
	return data;
}

export async function waitForVideoJob(apiKey, videoId, {
	maxAttempts = 90,
	intervalMs = 5000,
} = {}) {
	for (let i = 0; i < maxAttempts; i++) {
		const job = await getVideoJob(apiKey, videoId);
		if (job.status === "completed") return job;
		if (job.status === "failed" || job.status === "cancelled") {
			const msg = job.error?.message || job.status;
			throw new Error(`sora_job_${job.status}:${msg}`);
		}
		await new Promise((r) => setTimeout(r, intervalMs));
	}
	throw new Error("sora_timeout");
}

/** @returns {Promise<Uint8Array>} */
export async function downloadVideoContent(apiKey, videoId) {
	const res = await openaiFetch(apiKey, `/${encodeURIComponent(videoId)}/content`);
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`sora_download_failed:${res.status}:${text.slice(0, 200)}`);
	}
	const buf = new Uint8Array(await res.arrayBuffer());
	if (!buf.byteLength) throw new Error("sora_download_empty");
	return buf;
}
