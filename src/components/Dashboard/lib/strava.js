// Strava-specific helpers: distance/pace formatting + polyline decode.

import { pad } from "./utils.js";

export const STRAVA_ICONS = {
	Run: "🏃", TrailRun: "🏃", VirtualRun: "🏃", Walk: "🚶", Hike: "🥾",
	Ride: "🚴", VirtualRide: "🚴", EBikeRide: "🚴", MountainBikeRide: "🚵",
	Swim: "🏊", Workout: "💪", WeightTraining: "🏋️", Yoga: "🧘",
	AlpineSki: "⛷️", BackcountrySki: "⛷️", NordicSki: "⛷️", Snowboard: "🏂",
	Kayaking: "🛶", Rowing: "🚣",
};

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

// Decode a Google-encoded polyline string into an array of [lat,lng] pairs.
export function decodePolyline(str, precision = 5) {
	if (!str) return [];
	const factor = Math.pow(10, precision);
	const len = str.length;
	let index = 0, lat = 0, lng = 0;
	const points = [];
	while (index < len) {
		let b, shift = 0, result = 0;
		do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
		lat += (result & 1) ? ~(result >> 1) : (result >> 1);
		shift = 0; result = 0;
		do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
		lng += (result & 1) ? ~(result >> 1) : (result >> 1);
		points.push([lat / factor, lng / factor]);
	}
	return points;
}

export function polylineToSvgPath(encoded, width = 56, height = 38, padding = 5) {
	const pts = decodePolyline(encoded);
	if (pts.length < 2) return null;
	let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
	for (const [lat, lng] of pts) {
		if (lat < minLat) minLat = lat;
		if (lat > maxLat) maxLat = lat;
		if (lng < minLng) minLng = lng;
		if (lng > maxLng) maxLng = lng;
	}
	const dLat = maxLat - minLat || 1;
	const dLng = maxLng - minLng || 1;
	const w = width - padding * 2;
	const h = height - padding * 2;
	const scale = Math.min(w / dLng, h / dLat);
	const offsetX = padding + (w - dLng * scale) / 2;
	const offsetY = padding + (h - dLat * scale) / 2;
	return pts.map(([lat, lng], i) => {
		const x = offsetX + (lng - minLng) * scale;
		const y = offsetY + (maxLat - lat) * scale; // SVG y grows down
		return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
	}).join(" ");
}
