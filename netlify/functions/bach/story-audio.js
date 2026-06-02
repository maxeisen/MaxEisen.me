// GET /.netlify/functions/bach-story-audio?code=&round=

import {
	passwordOk, getSessionStore, validCode, readMeta, keys,
} from "./_lib.js";

export default async function handler(req) {
	if (req.method !== "GET") {
		return new Response(JSON.stringify({ error: "Method not allowed" }), {
			status: 405,
			headers: { "Content-Type": "application/json" },
		});
	}
	if (!passwordOk(req)) {
		return new Response(JSON.stringify({ error: "unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const url = new URL(req.url);
	const code = (url.searchParams.get("code") || "").toUpperCase();
	const round = Number(url.searchParams.get("round"));
	if (!validCode(code) || !Number.isInteger(round) || round < 0) {
		return new Response(JSON.stringify({ error: "invalid_params" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const store = getSessionStore();
	const meta = await readMeta(store, code);
	if (!meta) {
		return new Response(JSON.stringify({ error: "no_such_session" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	const audio = await store.get(keys.storyAudio(code, round));
	if (!audio) {
		return new Response(JSON.stringify({ error: "not_found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	let bytes;
	if (audio instanceof ArrayBuffer) bytes = audio;
	else if (audio instanceof Uint8Array) bytes = audio;
	else if (typeof audio === "string") bytes = Uint8Array.from(audio, (c) => c.charCodeAt(0));
	else bytes = new Uint8Array(audio);
	return new Response(bytes, {
		status: 200,
		headers: {
			"Content-Type": "audio/mpeg",
			"Cache-Control": "private, no-store",
		},
	});
}
