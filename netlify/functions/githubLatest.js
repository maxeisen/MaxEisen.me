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
		// Anchor "today" at end-of-day UTC and walk back HEATMAP_WEEKS, snapping to the start of that week (Sunday).
		const today = new Date();
		const endOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59));
		const start = new Date(endOfToday);
		start.setUTCDate(endOfToday.getUTCDate() - (HEATMAP_WEEKS * 7 - 1));
		// Snap start back to the most recent Sunday so the GraphQL response aligns to whole weeks.
		start.setUTCDate(start.getUTCDate() - start.getUTCDay());
		start.setUTCHours(0, 0, 0, 0);

		// Query as `viewer` (the token owner) so private contributions are included
		// without depending on the public profile visibility setting.
		// Also pull the public-only `user(login:)` view in parallel so the response
		// can self-diagnose whether the token has elevated visibility.
		const query = `query($from: DateTime!, $to: DateTime!) {
			viewer {
				login
				contributionsCollection(from: $from, to: $to) {
					contributionCalendar {
						totalContributions
						weeks {
							contributionDays {
								date
								contributionCount
							}
						}
					}
				}
			}
			user(login: "${USERNAME}") {
				contributionsCollection(from: $from, to: $to) {
					contributionCalendar {
						totalContributions
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

		// Heatmap: array of weeks (oldest → newest), each with 7 days (Sun → Sat)
		let heatmapWeeks = [];
		let total = 0;
		let diag = null;
		const todayKey = isoDate(endOfToday);
		if (contribRes.ok) {
			const contrib = await contribRes.json();
			const calendar = contrib?.data?.viewer?.contributionsCollection?.contributionCalendar;
			total = calendar?.totalContributions || 0;
			heatmapWeeks = (calendar?.weeks || []).map((w) => ({
				days: w.contributionDays.map((d) => ({
					date: d.date,
					count: d.contributionCount,
					future: d.date > todayKey,
				})),
			}));
			// Trim to the last HEATMAP_WEEKS in case the API returns extras
			if (heatmapWeeks.length > HEATMAP_WEEKS) {
				heatmapWeeks = heatmapWeeks.slice(heatmapWeeks.length - HEATMAP_WEEKS);
			}
			diag = {
				viewerLogin: contrib?.data?.viewer?.login || null,
				viewerTotal: total,
				publicUserTotal: contrib?.data?.user?.contributionsCollection?.contributionCalendar?.totalContributions ?? null,
				graphqlErrors: contrib?.errors || null,
				oauthScopes: contribRes.headers.get("x-oauth-scopes") || null,
			};
		} else {
			console.error("GitHub GraphQL failed:", contribRes.status, await contribRes.text());
			diag = { httpStatus: contribRes.status };
		}

		// 7-day total derived from the heatmap so it matches what users see
		const last7 = [];
		for (const w of heatmapWeeks) {
			for (const d of w.days) last7.push(d);
		}
		const last7Total = last7.slice(-7).reduce((acc, d) => acc + (d.future ? 0 : d.count), 0);

		// Latest push event (public only, by API design)
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
			_diag: diag,
		});
	} catch (err) {
		console.error(err);
		return jsonResponse({ error: "github_failed" }, 502);
	}
}
