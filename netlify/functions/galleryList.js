function getEnv(name) {
	if (typeof Netlify !== "undefined" && Netlify.env?.get) {
		return Netlify.env.get(name);
	}
	return process.env[name];
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=300, stale-while-revalidate=900",
			...extraHeaders,
		},
	});
}

const CLOUD_NAME = "meisen-gallery";

// Cloudinary tags we serve. "gallery" is open; "ride" and "run" require the
// matching password (sent via X-Gallery-Password) to be released.
const TAG_CONFIG = {
	gallery: { passwordEnv: null },
	ride:    { passwordEnv: "GALLERY_RIDE_PASSWORD" },
	run:     { passwordEnv: "GALLERY_RUN_PASSWORD" },
};

export default async function handler(req) {
	const url = new URL(req.url);
	const tag = (url.searchParams.get("tag") || "gallery").toLowerCase();
	const config = TAG_CONFIG[tag];
	if (!config) {
		return jsonResponse({ error: "Unknown tag" }, 400);
	}

	// Gate protected tags behind the password header. Don't cache an
	// unauthorized response — different viewers may have different rights.
	if (config.passwordEnv) {
		const expected = getEnv(config.passwordEnv);
		if (!expected) {
			console.error(`${config.passwordEnv} env var is not set in Netlify.`);
			return jsonResponse({ error: "not_configured" }, 503, { "Cache-Control": "no-store" });
		}
		const supplied = req.headers.get("x-gallery-password") || "";
		if (supplied !== expected) {
			return jsonResponse({ error: "unauthorized" }, 401, { "Cache-Control": "no-store" });
		}
	}

	const apiKey = getEnv("CLOUDINARY_API_KEY");
	const apiSecret = getEnv("CLOUDINARY_API_SECRET");
	if (!apiKey || !apiSecret) {
		return jsonResponse({ error: "not_configured" }, 503);
	}

	const auth = btoa(`${apiKey}:${apiSecret}`);
	const searchUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`;
	const body = {
		expression: `tags=${tag}`,
		max_results: 500,
		with_field: ["metadata", "context"],
	};

	let res;
	try {
		res = await fetch(searchUrl, {
			method: "POST",
			headers: {
				"Authorization": `Basic ${auth}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});
	} catch (err) {
		console.error("Cloudinary search request failed:", err.message);
		return jsonResponse({ error: "request_failed" }, 502);
	}

	if (!res.ok) {
		const text = await res.text();
		console.error("Cloudinary search failed:", res.status, text);
		return jsonResponse({ error: "search_failed" }, 502);
	}

	const data = await res.json();
	const resources = (data.resources || []).map((r) => {
		const meta = r.metadata || {};
		const ctx = r.context?.custom || r.context || {};
		const location = meta.location || meta.Location || ctx.location || null;
		return {
			public_id: r.public_id,
			format: r.format,
			width: r.width,
			height: r.height,
			created_at: r.created_at,
			location,
		};
	});

	return jsonResponse({ resources });
}
