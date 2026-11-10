// Canned responses for every feed the dashboard reads, so the layout can be
// checked against realistic content instead of loading spinners. Long strings
// are deliberate: what a widget has to cope with is a long track name or
// commit message, not the tidy one.

const DAY = 86_400_000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

function contributionWeeks() {
	const today = Date.now();
	const start = today - 52 * 7 * DAY - new Date(today).getUTCDay() * DAY;
	return Array.from({ length: 53 }, (_, w) => ({
		days: Array.from({ length: 7 }, (_, d) => {
			const ms = start + (w * 7 + d) * DAY;
			return ms > today
				? { date: isoDay(ms), count: 0, future: true }
				: { date: isoDay(ms), count: (w * 7 + d) % 9 };
		}),
	}));
}

const route = [[0, 0], [10, 4], [18, 12], [14, 22], [4, 18], [0, 0]];

export const github = {
	latest: {
		repo: "maxeisen/MaxEisen.me",
		message: "Lay the dashboard out from the window's real size, squeezing rows before scrolling, and let widgets be shown and hidden",
		commits: 3,
		createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
		url: "https://github.com/maxeisen/MaxEisen.me",
	},
	contributions: { weeks: contributionWeeks(), total: 1234 },
};

export const strava = {
	activities: Array.from({ length: 5 }, (_, i) => ({
		id: 1000 + i,
		name: ["Morning Run along the waterfront trail", "Lunch Ride", "Tempo Tuesday", "Long Run", "Recovery jog"][i],
		type: i === 1 ? "Ride" : "Run",
		distance: 8000 + i * 1500,
		movingTime: 2400 + i * 300,
		startDate: new Date(Date.now() - (i + 1) * DAY).toISOString(),
		sufferScore: 40 + i * 7,
		route,
	})),
	ytd: {
		run: { distance: 1_250_000, count: 142 },
		ride: { distance: 2_400_000, count: 61 },
	},
};

export const spotify = {
	playing: true,
	track: "An Exceptionally Long Song Title (Extended Live Version) [Remastered 2026]",
	artist: "The Band With A Long Name, Featuring Several Guests",
	album: "A Long Album Title That Goes On For Quite A While",
	albumArt: null,
	url: "https://open.spotify.com/",
	id: "track-1",
	durationMs: 240_000,
	progressMs: 60_000,
};

export const forecast = {
	current: {
		temperature_2m: 21.4,
		weather_code: 2,
		apparent_temperature: 20.1,
		wind_speed_10m: 14,
		uv_index: 5.2,
	},
	daily: {
		time: [isoDay(Date.now() - DAY), isoDay(Date.now())],
		sunrise: [`${isoDay(Date.now() - DAY)}T07:01`, `${isoDay(Date.now())}T07:02`],
		sunset: [`${isoDay(Date.now() - DAY)}T16:55`, `${isoDay(Date.now())}T16:53`],
	},
};

export const airQuality = { current: { european_aqi: 32 } };
export const geocode = { city: "Toronto", principalSubdivision: "Ontario", countryName: "Canada" };

export const hnIds = Array.from({ length: 10 }, (_, i) => 100 + i);
export const hnItem = (id) => ({
	id,
	score: 300 + id,
	title: `Story ${id}: a headline long enough that it has to wrap onto a second line in a narrow tile`,
	url: `https://example.com/articles/${id}`,
});

const PIXEL = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	"base64",
);

/** Route every dashboard feed to the fixtures above. */
export async function mockDashboardFeeds(page) {
	const json = (body) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
	await page.route("**/.netlify/functions/githubLatest*", (r) => r.fulfill(json(github)));
	await page.route("**/.netlify/functions/stravaFeed*", (r) => r.fulfill(json(strava)));
	await page.route("**/.netlify/functions/spotifyNowPlaying*", (r) => r.fulfill(json(spotify)));
	await page.route("https://api.open-meteo.com/**", (r) => r.fulfill(json(forecast)));
	await page.route("https://air-quality-api.open-meteo.com/**", (r) => r.fulfill(json(airQuality)));
	await page.route("https://api.bigdatacloud.net/**", (r) => r.fulfill(json(geocode)));
	await page.route("https://hacker-news.firebaseio.com/v0/topstories.json", (r) => r.fulfill(json(hnIds)));
	await page.route("https://hacker-news.firebaseio.com/v0/item/*", (r) => {
		const id = Number(r.request().url().match(/item\/(\d+)\.json/)[1]);
		return r.fulfill(json(hnItem(id)));
	});
	// One photo in the list, and every image request answered with a 1×1
	// PNG: enough for the gallery to count as loaded.
	await page.route("https://res.cloudinary.com/**", (r) => (
		r.request().url().endsWith(".json")
			? r.fulfill(json({ resources: [{ public_id: "gallery/one" }] }))
			: r.fulfill({ status: 200, contentType: "image/png", body: PIXEL })
	));
}
