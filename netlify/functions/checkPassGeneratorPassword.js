function getEnv(name) {
	if (typeof Netlify !== "undefined" && Netlify.env?.get) {
		return Netlify.env.get(name);
	}
	return process.env[name];
}

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export default async function handler(req) {
	if (req.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	let body;
	try {
		body = await req.json();
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	const password = typeof body?.password === "string" ? body.password : "";
	const expected = getEnv("PASS_GENERATOR_PASSWORD");

	if (!expected) {
		console.error("PASS_GENERATOR_PASSWORD env var is not set");
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	if (password !== expected) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	return jsonResponse({ ok: true });
}
