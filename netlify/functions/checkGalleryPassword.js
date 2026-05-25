// Validates the password for a per-scope gallery page.
//
// The scope ("ride", "run", or any future addition) is mapped to a Netlify
// env var named `GALLERY_<SCOPE>_PASSWORD` (uppercased). Adding a new
// gated gallery only requires setting the matching env var — no function
// code changes.
//
// We deliberately don't surface whether a scope is configured: a request
// for a scope with no env var set responds the same way as a request with
// a wrong password (401). That keeps the function's behaviour predictable
// for clients and avoids leaking which scopes exist server-side.

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

// Scope must be a short, plain-letters-and-digits slug. Anything else is a
// malformed request — we reject early so we never try to read an env var
// derived from arbitrary user input.
const SCOPE_RE = /^[a-z0-9]{1,32}$/;

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
	if (!SCOPE_RE.test(scope)) {
		return jsonResponse({ error: "Invalid scope" }, 400);
	}

	const password = typeof body?.password === "string" ? body.password : "";
	const envName = `GALLERY_${scope.toUpperCase()}_PASSWORD`;
	const expected = getEnv(envName);

	// No env var → behave as if the password is just wrong. Don't tip off
	// callers about which scopes are real on this deployment.
	if (!expected || password !== expected) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	return jsonResponse({ ok: true });
}
