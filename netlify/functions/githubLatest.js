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
			"Cache-Control": "public, max-age=120, stale-while-revalidate=300",
		},
	});
}

const USERNAME = "maxeisen";

export default async function handler() {
	const token = getEnv("GITHUB_TOKEN");
	if (!token) {
		return jsonResponse({ error: "not_configured" }, 503);
	}

	try {
		const res = await fetch(`https://api.github.com/users/${USERNAME}/events/public?per_page=30`, {
			headers: {
				"Authorization": `Bearer ${token}`,
				"Accept": "application/vnd.github+json",
				"User-Agent": "maxeisen.me-dashboard",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});
		if (!res.ok) {
			const text = await res.text();
			console.error("GitHub events failed:", res.status, text);
			return jsonResponse({ error: "github_failed" }, 502);
		}
		const events = await res.json();
		const push = events.find((e) => e.type === "PushEvent");
		if (!push) return jsonResponse({});
		const lastCommit = push.payload?.commits?.[push.payload.commits.length - 1];
		return jsonResponse({
			repo: push.repo?.name || null,
			message: lastCommit?.message?.split("\n")[0] || null,
			commits: push.payload?.commits?.length || 1,
			createdAt: push.created_at,
			url: push.repo ? `https://github.com/${push.repo.name}/commits` : null,
		});
	} catch (err) {
		console.error(err);
		return jsonResponse({ error: "github_failed" }, 502);
	}
}
