// GET /.netlify/functions/bach-story-video?code=&round=

import {
	passwordOk, getSessionStore, validCode, readMeta, readStoryVideoBytes,
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

	const bytes = await readStoryVideoBytes(store, code, round);
	if (!bytes?.length) {
		return new Response(JSON.stringify({ error: "not_found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(bytes, {
		status: 200,
		headers: {
			"Content-Type": "video/mp4",
			"Cache-Control": "private, no-store",
		},
	});
}
