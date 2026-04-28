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
const HEATMAP_WEEKS = 12;

function isoDate(d) {
	return d.toISOString().slice(0, 10);
}

export default async function handler() {
	const token = getEnv("GITHUB_TOKEN");
	if (!token) {
		return jsonResponse({ error: "not_configured" }, 503);
	}

	const baseHeaders = {
		"Authorization": `Bearer ${token}`,
		"User-Agent": "maxeisen.me-dashboard",
	};

	try {
		// Anchor "today" at end-of-day UTC, walk back HEATMAP_WEEKS, snap to Sunday.
		const today = new Date();
		const endOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59));
		const start = new Date(endOfToday);
		start.setUTCDate(endOfToday.getUTCDate() - (HEATMAP_WEEKS * 7 - 1));
		start.setUTCDate(start.getUTCDate() - start.getUTCDay());
		start.setUTCHours(0, 0, 0, 0);

		// commitContributionsByRepository is viewer-only and includes private repos.
		// We aggregate counts by UTC date server-side; repo identifiers never leave
		// this function.
		const query = `query($from: DateTime!, $to: DateTime!) {
			viewer {
				contributionsCollection(from: $from, to: $to) {
					totalCommitContributions
					commitContributionsByRepository(maxRepositories: 100) {
						contributions(first: 100) {
							nodes {
								occurredAt
								commitCount
							}
						}
					}
				}
			}
		}`;

		const [contribRes, eventsRes] = await Promise.all([
			fetch("https://api.github.com/graphql", {
				method: "POST",
				headers: { ...baseHeaders, "Content-Type": "application/json" },
				body: JSON.stringify({
					query,
					variables: { from: start.toISOString(), to: endOfToday.toISOString() },
				}),
			}),
			fetch(`https://api.github.com/users/${USERNAME}/events/public?per_page=30`, {
				headers: {
					...baseHeaders,
					"Accept": "application/vnd.github+json",
					"X-GitHub-Api-Version": "2022-11-28",
				},
			}),
		]);

		const todayKey = isoDate(endOfToday);
		const commitsByDate = new Map(); // UTC ISO date → count
		let total = 0;

		if (contribRes.ok) {
			const contrib = await contribRes.json();
			const collection = contrib?.data?.viewer?.contributionsCollection;
			const repos = collection?.commitContributionsByRepository || [];
			for (const r of repos) {
				for (const node of (r.contributions?.nodes || [])) {
					const date = (node.occurredAt || "").slice(0, 10);
					if (!date) continue;
					commitsByDate.set(date, (commitsByDate.get(date) || 0) + (node.commitCount || 0));
				}
			}
			total = collection?.totalCommitContributions || 0;
		} else {
			console.error("GitHub GraphQL failed:", contribRes.status);
		}

		// Build heatmap from the per-repo commit map.
		const heatmapWeeks = [];
		for (let w = 0; w < HEATMAP_WEEKS; w++) {
			const days = [];
			for (let d = 0; d < 7; d++) {
				const cell = new Date(start);
				cell.setUTCDate(start.getUTCDate() + w * 7 + d);
				const key = isoDate(cell);
				days.push({
					date: key,
					count: commitsByDate.get(key) || 0,
					future: key > todayKey,
				});
			}
			heatmapWeeks.push({ days });
		}

		// 7-day total derived from the heatmap so it matches the visible cells.
		const flat = heatmapWeeks.flatMap((w) => w.days);
		const last7Total = flat.slice(-7).reduce((acc, d) => acc + (d.future ? 0 : d.count), 0);

		// Latest push event (public only by API design).
		let latest = null;
		if (eventsRes.ok) {
			const events = await eventsRes.json();
			const push = events.find((e) => e.type === "PushEvent");
			if (push) {
				const lastCommit = push.payload?.commits?.[push.payload.commits.length - 1];
				latest = {
					repo: push.repo?.name || null,
					message: lastCommit?.message?.split("\n")[0] || null,
					commits: push.payload?.commits?.length || 1,
					createdAt: push.created_at,
					url: push.repo ? `https://github.com/${push.repo.name}/commits` : null,
				};
			}
		}

		return jsonResponse({
			latest,
			contributions: {
				total,
				last7Total,
				weeks: heatmapWeeks,
			},
		});
	} catch (err) {
		console.error("githubLatest error:", err.message);
		return jsonResponse({ error: "github_failed" }, 502);
	}
}
