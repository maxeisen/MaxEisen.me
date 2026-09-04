import { describe, it, expect, vi, beforeEach } from "vitest";

async function payload() {
	const { default: handler } = await import("../stravaFeed.js");
	const res = await handler(new Request("https://maxeisen.me/.netlify/functions/stravaFeed"));
	return { res, body: await res.json() };
}

beforeEach(() => {
	vi.resetModules();
	process.env.STRAVA_CLIENT_ID = "id";
	process.env.STRAVA_CLIENT_SECRET = "secret";
	process.env.STRAVA_REFRESH_TOKEN = "refresh";
});

describe("stravaFeed", () => {
	it("caches a 429 so the next request does not hit Strava", async () => {
		globalThis.fetch = vi.fn(async (url) => {
			if (String(url).includes("/oauth/token")) {
				return new Response(
					JSON.stringify({ access_token: "tok", expires_at: Math.floor(Date.now() / 1000) + 3600 }),
					{ status: 200 },
				);
			}
			return new Response("nope", {
				status: 429,
				headers: {
					"x-ratelimit-limit": "100,1000",
					"x-ratelimit-usage": "100,200",
				},
			});
		});

		const first = await payload();
		expect(first.res.status).toBe(429);
		expect(first.body.error).toBe("strava_failed");
		const afterFirst = globalThis.fetch.mock.calls.length;

		const second = await payload();
		expect(second.res.status).toBe(429);
		expect(globalThis.fetch.mock.calls.length).toBe(afterFirst);
	});
});
