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

// Scope must be plain lowercase alnum so we can safely interpolate it into
// the env var name and Cloudinary tag/folder. Anything else is rejected
// before we touch state.
const SCOPE_RE = /^[a-z0-9]{1,32}$/;

// Conventions for an arbitrary scope:
//   tag         → scope as-is (e.g. "ride")
//   folder      → scope + "s" (e.g. "rides") to match the existing
//                 ride/run layout in Cloudinary and so new galleries
//                 auto-pluralize without a per-scope code change
//   passwordEnv → GALLERY_<SCOPE>_PASSWORD (uppercased)
function configForScope(scope) {
	return {
		tag: scope,
		folder: `${scope}s`,
		passwordEnv: `GALLERY_${scope.toUpperCase()}_PASSWORD`,
	};
}

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
	if (!SCOPE_RE.test(scopeName)) {
		return jsonResponse({ error: "invalid scope" }, 400);
	}
	const scope = configForScope(scopeName);

	// Auth: password check. If the env var isn't set we treat the scope as
	// nonexistent (401) rather than leaking a 503 "not configured".
	const supplied = req.headers.get("x-gallery-password") || "";
	const expected = getEnv(scope.passwordEnv);
	if (!expected || supplied !== expected) {
		return jsonResponse({ error: "unauthorized" }, 401);
	}

	const apiKey = getEnv("CLOUDINARY_API_KEY");
	const apiSecret = getEnv("CLOUDINARY_API_SECRET");
	if (!apiKey || !apiSecret) {
		return jsonResponse({ error: "not_configured" }, 503);
	}

	// Uploader identity — set as the `uploader` structured metadata field on
	// the asset, so it's visible in the asset's metadata in Cloudinary and
	// can be displayed alongside other captions on the front end.
	//
	// The corresponding structured metadata field (external_id: "uploader",
	// type: string) must exist in this Cloudinary account — configured via
	// Admin Console → Settings → Metadata. If it isn't, Cloudinary rejects
	// the upload with a clear error and the client surfaces it.
	const rawUploader = typeof body?.uploader === "string" ? body.uploader : "";
	const uploaderTrimmed = rawUploader.trim().slice(0, 64);

	// Cloudinary's `metadata` upload param uses `external_id=value` pairs
	// joined by `|`. Values containing `|`, `=`, `,`, or quotes must be
	// wrapped in double quotes (escaping internal quotes with `\`).
	// Names won't usually contain those, but defend against it anyway.
	let metadataField = "";
	if (uploaderTrimmed) {
		const needsQuoting = /[|=,"\\]/.test(uploaderTrimmed);
		const value = needsQuoting
			? `"${uploaderTrimmed.replace(/(["\\])/g, "\\$1")}"`
			: uploaderTrimmed;
		metadataField = `uploader=${value}`;
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
	if (metadataField) signedParams.metadata = metadataField;

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
		metadata: metadataField || undefined,
		signature,
	});
}
