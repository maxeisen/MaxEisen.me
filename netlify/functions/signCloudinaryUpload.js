// Returns a short-lived Cloudinary signed-upload payload that the browser
// uses to POST images directly to Cloudinary. The signature is over a fixed
// set of params (tags + folder + timestamp) — the client can't widen the tag
// set or move uploads to a different folder, because doing so would
// invalidate the signature and Cloudinary would reject.
//
// Auth: the caller must already know the per-scope gallery password (sent on
// X-Gallery-Password). That's the same gate that controls reading the
// gallery, so anyone who can see the page can also upload to it.

function getEnv(name) {
	if (typeof Netlify !== "undefined" && Netlify.env?.get) {
		return Netlify.env.get(name);
	}
	return process.env[name];
}

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store",
		},
	});
}

const CLOUD_NAME = "meisen-gallery";
const ALLOWED_SCOPES = {
	ride: { tag: "ride", folder: "rides", passwordEnv: "GALLERY_RIDE_PASSWORD" },
	run:  { tag: "run",  folder: "runs",  passwordEnv: "GALLERY_RUN_PASSWORD"  },
};

async function sha1Hex(str) {
	const data = new TextEncoder().encode(str);
	const hash = await crypto.subtle.digest("SHA-1", data);
	return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default async function handler(req) {
	if (req.method !== "POST") {
		return jsonResponse({ error: "method not allowed" }, 405);
	}

	let body;
	try {
		body = await req.json();
	} catch {
		return jsonResponse({ error: "invalid json" }, 400);
	}

	const scopeName = typeof body?.scope === "string" ? body.scope.toLowerCase() : "";
	const scope = ALLOWED_SCOPES[scopeName];
	if (!scope) return jsonResponse({ error: "unknown scope" }, 400);

	// Auth: password check.
	const supplied = req.headers.get("x-gallery-password") || "";
	const expected = getEnv(scope.passwordEnv);
	if (!expected) {
		console.error(`${scope.passwordEnv} env var is not set in Netlify.`);
		return jsonResponse({ error: "not_configured" }, 503);
	}
	if (supplied !== expected) {
		return jsonResponse({ error: "unauthorized" }, 401);
	}

	const apiKey = getEnv("CLOUDINARY_API_KEY");
	const apiSecret = getEnv("CLOUDINARY_API_SECRET");
	if (!apiKey || !apiSecret) {
		return jsonResponse({ error: "not_configured" }, 503);
	}

	const timestamp = Math.floor(Date.now() / 1000);
	// Cloudinary signature spec: sort all params alphabetically, join with &,
	// append apiSecret, SHA-1 hex. Excluded from signing: file, cloud_name,
	// resource_type, api_key, signature itself.
	const signedParams = {
		folder: scope.folder,
		tags: scope.tag,
		timestamp,
	};
	const sortedString = Object.keys(signedParams)
		.sort()
		.map((k) => `${k}=${signedParams[k]}`)
		.join("&");
	const signature = await sha1Hex(sortedString + apiSecret);

	return jsonResponse({
		cloud_name: CLOUD_NAME,
		api_key: apiKey,
		timestamp,
		folder: scope.folder,
		tags: scope.tag,
		signature,
	});
}
