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
			"Cache-Control": "public, max-age=300, stale-while-revalidate=900",
		},
	});
}

const CLOUD_NAME = "decfdmwnw";
const TAG = "gallery";

export default async function handler() {
	const apiKey = getEnv("CLOUDINARY_API_KEY");
	const apiSecret = getEnv("CLOUDINARY_API_SECRET");
	if (!apiKey || !apiSecret) {
		return jsonResponse({ error: "not_configured" }, 503);
	}

	const auth = btoa(`${apiKey}:${apiSecret}`);
	const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`;
	const body = {
		expression: `tags=${TAG}`,
		max_results: 500,
		with_field: ["metadata", "context"],
	};

	let res;
	try {
		res = await fetch(url, {
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
