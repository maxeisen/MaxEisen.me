// Validates the password for the per-sport gallery pages (/gallery/ride and
// /gallery/run). The two passwords are sourced from Netlify env vars
// GALLERY_RIDE_PASSWORD and GALLERY_RUN_PASSWORD.

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

const ALLOWED_SCOPES = new Set(["ride", "run"]);

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

	const scope = typeof body?.scope === "string" ? body.scope.toLowerCase() : "";
	if (!ALLOWED_SCOPES.has(scope)) {
		return jsonResponse({ error: "Unknown scope" }, 400);
	}

	const password = typeof body?.password === "string" ? body.password : "";
	const envName = scope === "ride" ? "GALLERY_RIDE_PASSWORD" : "GALLERY_RUN_PASSWORD";
	const expected = getEnv(envName);

	if (!expected) {
		console.error(`${envName} env var is not set in Netlify.`);
		return jsonResponse({ error: "Service unavailable" }, 503);
	}

	if (password !== expected) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	return jsonResponse({ ok: true });
}
