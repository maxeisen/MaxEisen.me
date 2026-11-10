import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const track = (id, name) => ({
	id,
	name,
	artists: [{ id: `a-${id}`, name: `Artist ${id}` }],
	album: { name: "Album", images: [{ url: "https://img" }] },
	external_urls: { spotify: `https://open.spotify.com/track/${id}` },
	duration_ms: 200_000,
});

function respond(body, status = 200) {
	return Promise.resolve({
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body),
		text: () => Promise.resolve(JSON.stringify(body)),
	});
}

describe("spotifyNowPlaying, when nothing is playing", () => {
	beforeEach(() => {
		vi.resetModules();
		process.env.SPOTIFY_CLIENT_ID = "id";
		process.env.SPOTIFY_CLIENT_SECRET = "secret";
		process.env.SPOTIFY_REFRESH_TOKEN = "refresh";
		vi.stubGlobal("fetch", vi.fn((url) => {
			if (url.includes("accounts.spotify.com")) return respond({ access_token: "t", expires_in: 3600 });
			if (url.includes("currently-playing")) return respond(null, 204);
			if (url.includes("recently-played")) {
				return respond({
					items: [
						{ track: track("1", "Last"), played_at: "2026-11-10T12:00:00Z" },
						{ track: track("1", "Last"), played_at: "2026-11-10T11:56:00Z" },
						{ track: track("2", "Before"), played_at: "2026-11-10T11:52:00Z" },
						{ track: track("3", "Earlier"), played_at: "2026-11-10T11:48:00Z" },
					],
				});
			}
			if (url.includes("/artists/")) return respond({ genres: ["indie"] });
			throw new Error(`unexpected fetch ${url}`);
		}));
	});
	afterEach(() => vi.unstubAllGlobals());

	it("returns the last track, and the distinct ones before it", async () => {
		const { default: handler } = await import("../spotifyNowPlaying.js");
		const body = await (await handler()).json();
		expect(body).toMatchObject({ playing: false, track: "Last", playedAt: "2026-11-10T12:00:00Z" });
		expect(body.recent.map((t) => t.track)).toEqual(["Before", "Earlier"]);
		expect(body.recent[0]).toMatchObject({ artist: "Artist 2", url: "https://open.spotify.com/track/2" });
		const recentCall = fetch.mock.calls.find(([url]) => url.includes("recently-played"));
		expect(recentCall[0]).toContain("limit=8");
	});
});
