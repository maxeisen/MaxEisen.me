// Current conditions for the dashboard, shared by whichever widgets want them.
//
// This used to live inside WeatherWidget, which also filled the sun store the
// Clock reads its daylight line from. Once widgets could be hidden, hiding
// Weather would have quietly blanked part of the Clock. Now any widget that
// needs the data subscribes: the first subscriber starts the geolocation and
// the 15-minute poll, the last one to leave stops it, and the results land in
// `weather` (display strings) and the shared `sun` store.

/* global $state -- a compiler intrinsic, not an import. */

import { location, sun } from "./stores.svelte.js";
import { createPoller } from "../../../lib/data/poller.js";

const FALLBACK = { lat: 43.6532, lon: -79.3832 }; // Toronto

const WMO = {
	0: ["Clear", "☀️"],
	1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
	45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"],
	51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
	56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
	61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
	66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"],
	71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"],
	77: ["Snow grains", "🌨️"],
	80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"], 82: ["Heavy showers", "⛈️"],
	85: ["Snow showers", "🌨️"], 86: ["Snow showers", "❄️"],
	95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm + hail", "⛈️"], 99: ["Thunderstorm + hail", "⛈️"],
};

export const weather = $state({
	// "loading" until the first forecast lands, then "ready"; "failed" only
	// if it never has. A failure after that keeps the last reading up.
	status: "loading",
	temp: "—°",
	cond: "—",
	meta: "Locating…",
	feels: "—",
	wind: "—",
	uv: "—",
	aqi: "—",
	sunriseLabel: "—",
	sunsetLabel: "—",
	// The next 24 hours from now, and the next five days from today, in the
	// location's own time: [{time, hour, temp, precip, wind, code}] and
	// [{date, code, hi, lo, precip}]. Empty until the first forecast lands.
	hourly: [],
	days: [],
	// Local time of the reading ("2026-11-10T14:00"), and today's sunset as
	// the same kind of string, for the ride check.
	localTime: null,
	sunsetLocal: null,
});

/** Emoji and label for a WMO weather code. */
export function describeCode(code) {
	const [label, emoji] = WMO[code] || ["—", ""];
	return { label, emoji };
}

function uvBand(v) {
	if (v == null) return "—";
	const r = Math.round(v);
	if (r <= 2) return `${r} · low`;
	if (r <= 5) return `${r} · moderate`;
	if (r <= 7) return `${r} · high`;
	if (r <= 10) return `${r} · very high`;
	return `${r} · extreme`;
}

function aqiBand(v) {
	if (v == null) return "—";
	const r = Math.round(v);
	if (r <= 20) return `${r} · good`;
	if (r <= 40) return `${r} · fair`;
	if (r <= 60) return `${r} · moderate`;
	if (r <= 80) return `${r} · poor`;
	return `${r} · very poor`;
}

async function fetchJSON(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`fetch failed: ${url}`);
	return res.json();
}

function placeLabel(g) {
	const place = g.city || g.locality || g.principalSubdivision;
	const region = g.principalSubdivision && place !== g.principalSubdivision
		? g.principalSubdivision
		: g.countryName;
	if (place && region) return `${place}, ${region}`;
	return place || null;
}

function applySun(daily) {
	const todayKey = new Date().toISOString().slice(0, 10);
	const todayIdx = (daily.time || []).findIndex((t) => String(t).slice(0, 10) === todayKey);
	const tIdx = todayIdx >= 0 ? todayIdx : 0;
	sun.sunrise = new Date(daily.sunrise[tIdx]);
	sun.sunset = new Date(daily.sunset[tIdx]);
	weather.sunriseLabel = sun.sunrise.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
	weather.sunsetLabel = sun.sunset.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
	if (tIdx > 0 && daily.sunrise[tIdx - 1] && daily.sunset[tIdx - 1]) {
		const todayLen = (new Date(daily.sunset[tIdx]) - new Date(daily.sunrise[tIdx])) / 1000;
		const yestLen = (new Date(daily.sunset[tIdx - 1]) - new Date(daily.sunrise[tIdx - 1])) / 1000;
		sun.daylightDeltaSeconds = Math.round(todayLen - yestLen);
	}
}

const at = (list, i) => (Array.isArray(list) ? list[i] : undefined);

// Hours from the current one onward, and days from today onward. Times are
// the location's local wall clock (timezone=auto), compared as strings.
function applyOutlook({ current, hourly, daily }) {
	const now = String(current?.time || "").slice(0, 13); // "2026-11-10T14"
	weather.localTime = current?.time ?? null;
	if (hourly?.time) {
		const from = Math.max(0, hourly.time.findIndex((t) => String(t).slice(0, 13) >= now));
		weather.hourly = hourly.time.slice(from, from + 24).map((time, i) => ({
			time,
			hour: Number(String(time).slice(11, 13)),
			temp: at(hourly.temperature_2m, from + i),
			precip: at(hourly.precipitation_probability, from + i),
			wind: at(hourly.wind_speed_10m, from + i),
			code: at(hourly.weather_code, from + i),
		}));
	}
	if (daily?.time) {
		const today = now.slice(0, 10);
		const from = Math.max(0, daily.time.findIndex((t) => String(t).slice(0, 10) >= today));
		weather.sunsetLocal = at(daily.sunset, from) ?? null;
		weather.days = daily.time.slice(from, from + 5).map((date, i) => ({
			date,
			code: at(daily.weather_code, from + i),
			hi: at(daily.temperature_2m_max, from + i),
			lo: at(daily.temperature_2m_min, from + i),
			precip: at(daily.precipitation_probability_max, from + i),
		}));
	}
}

async function load(lat, lon) {
	try {
		const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
			+ "&current=temperature_2m,weather_code,apparent_temperature,wind_speed_10m,uv_index"
			+ "&hourly=temperature_2m,precipitation_probability,wind_speed_10m,weather_code"
			+ "&daily=sunrise,sunset,weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
			+ "&past_days=1&forecast_days=6&timezone=auto&wind_speed_unit=kmh";
		const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`;
		const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
		const [forecast, aqiR, geo] = await Promise.allSettled([
			fetchJSON(weatherUrl), fetchJSON(aqiUrl), fetchJSON(geoUrl),
		]);
		if (forecast.status !== "fulfilled") throw new Error("weather failed");
		const c = forecast.value.current;
		const [label, emoji] = WMO[c.weather_code] || ["—", ""];
		weather.temp = Math.round(c.temperature_2m) + "°";
		weather.cond = `${emoji} ${label}`;
		weather.feels = Math.round(c.apparent_temperature) + "°";
		weather.wind = Math.round(c.wind_speed_10m) + " km/h";
		weather.uv = uvBand(c.uv_index);
		if (aqiR.status === "fulfilled") weather.aqi = aqiBand(aqiR.value.current?.european_aqi);
		weather.meta = (geo.status === "fulfilled" && placeLabel(geo.value)) || "Location unavailable";
		if (forecast.value.daily) applySun(forecast.value.daily);
		applyOutlook(forecast.value);
		weather.status = "ready";
	} catch {
		if (weather.status !== "ready") {
			weather.status = "failed";
			weather.meta = "Unable to load weather";
		}
	}
}

function useLocation({ lat, lon }) {
	location.lat = lat;
	location.lon = lon;
	load(lat, lon);
}

// Geolocation is asked for once per page; later subscribers reuse it.
function acquireLocation() {
	if (location.lat != null) {
		load(location.lat, location.lon);
		return;
	}
	if (!navigator.geolocation) {
		weather.meta = "Geolocation unsupported";
		useLocation(FALLBACK);
		return;
	}
	navigator.geolocation.getCurrentPosition(
		(pos) => useLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
		() => useLocation(FALLBACK),
		{ enableHighAccuracy: false, maximumAge: 1000 * 60 * 10, timeout: 8000 },
	);
}

let subscribers = 0;
let stopPoll = null;

/**
 * Keep the weather data fresh while the caller is mounted.
 * @returns {() => void} unsubscribe; call it on destroy.
 */
export function subscribeWeather() {
	subscribers += 1;
	if (subscribers === 1) {
		acquireLocation();
		stopPoll = createPoller(() => {
			if (location.lat != null) load(location.lat, location.lon);
		}, 1000 * 60 * 15, { jitterMs: 30_000 });
	}
	let subscribed = true;
	return () => {
		if (!subscribed) return;
		subscribed = false;
		subscribers -= 1;
		if (subscribers === 0) {
			stopPoll?.();
			stopPoll = null;
		}
	};
}
