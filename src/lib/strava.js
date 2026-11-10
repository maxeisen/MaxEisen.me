// Shared Strava helpers: activity icons, distance/pace/duration formatting,
// and route shape → SVG path. Used by the dashboard StravaWidget
// and the homepage StravaActivityList (which previously reimplemented the
// decode + format logic), so it lives in src/lib rather than a feature folder.

const pad = (n) => String(n).padStart(2, "0");

export const STRAVA_ICONS = {
	Run: "🏃", TrailRun: "🏃", VirtualRun: "🏃", Walk: "🚶", Hike: "🥾",
	Ride: "🚴", VirtualRide: "🚴", EBikeRide: "🚴", MountainBikeRide: "🚵",
	Swim: "🏊", Workout: "💪", WeightTraining: "🏋️", Yoga: "🧘",
	AlpineSki: "⛷️", BackcountrySki: "⛷️", NordicSki: "⛷️", Snowboard: "🏂",
	Kayaking: "🛶", Rowing: "🚣",
};

// Shared so the dashboard widget and homepage lists both hit
// one URL and share the SWR cache instead of each inventing a query string.
export const STRAVA_FEED_URL = "/.netlify/functions/stravaFeed?limit=30";

export { STRAVA_ATHLETE_ID, STRAVA_PROFILE_URL } from "../../netlify/functions/_shared/stravaPublic.js";

export function formatDistance(m) {
	if (m == null) return "—";
	const km = m / 1000;
	return km >= 10 ? `${km.toFixed(1)} km` : `${km.toFixed(2)} km`;
}

export function formatDuration(s) {
	if (s == null) return "—";
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatPace(distanceM, timeS, type) {
	if (!distanceM || !timeS) return null;
	const km = distanceM / 1000;
	const isRun = /Run|Walk|Hike/.test(type || "");
	if (isRun) {
		const paceSecPerKm = timeS / km;
		const m = Math.floor(paceSecPerKm / 60);
		const s = Math.round(paceSecPerKm % 60);
		return `${m}:${pad(s)} /km`;
	}
	const speed = km / (timeS / 3600);
	return `${speed.toFixed(1)} km/h`;
}

// Route thumbnail → SVG path. The feed ships each route as a shape already
// fitted to a ROUTE_GRID square (see routeShape in stravaPublic.js) rather
// than as coordinates, so all that's left is to fit it into the widget's box.
export function routeToSvgPath(route, width = 56, height = 38, padding = 5) {
	if (!Array.isArray(route) || route.length < 2) return null;
	let maxX = 0, maxY = 0;
	for (const [x, y] of route) {
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
	const dx = maxX || 1;
	const dy = maxY || 1;
	const w = width - padding * 2;
	const h = height - padding * 2;
	const scale = Math.min(w / dx, h / dy);
	const offsetX = padding + (w - dx * scale) / 2;
	const offsetY = padding + (h - dy * scale) / 2;
	return route.map(([x, y], i) =>
		`${i === 0 ? "M" : "L"}${(offsetX + x * scale).toFixed(1)} ${(offsetY + y * scale).toFixed(1)}`,
	).join(" ");
}
