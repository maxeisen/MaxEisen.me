// Is it a good day for a ride? A one-line verdict from the hourly forecast.
//
// Looks at the daylight left today (or, once it's dark, tomorrow's riding
// hours) and reports the first thing that would spoil a ride: rain, wind,
// cold or heat. The thresholds are a road cyclist's rough comfort zone, not
// science; they live here so they're easy to change.

export const RIDE_LIMITS = {
	rainPct: 50, // chance of rain that counts as "likely"
	windKmh: 30, // sustained wind that makes a ride a slog
	coldC: 4, // a high below this is cold
	hotC: 32, // a high at or above this is hot
	minHours: 2, // fewer daylight hours than this left: look at tomorrow
	tomorrowFrom: 8,
	tomorrowTo: 18,
};

function hourLabel(hour, minute = 0) {
	const h = ((hour + 11) % 12) + 1;
	const m = minute ? `:${String(minute).padStart(2, "0")}` : "";
	return `${h}${m}${hour < 12 ? "am" : "pm"}`;
}

/**
 * @param {{time: string, hour: number, temp: number, precip: number, wind: number}[]} hours
 *   from now onward, local wall-clock times ("2026-11-10T14:00").
 * @param {{sunsetLocal?: string|null}} [context]
 * @returns {{tone: "good"|"warn", text: string, when: "today"|"tomorrow"}|null}
 */
export function rideVerdict(hours, { sunsetLocal = null } = {}, limits = RIDE_LIMITS) {
	if (!Array.isArray(hours) || hours.length === 0) return null;
	const today = String(hours[0].time).slice(0, 10);

	let when = "today";
	let window = hours.filter((h) => String(h.time).slice(0, 10) === today && (!sunsetLocal || h.time < sunsetLocal));
	if (window.length < limits.minHours) {
		when = "tomorrow";
		window = hours.filter((h) => String(h.time).slice(0, 10) > today
			&& h.hour >= limits.tomorrowFrom && h.hour < limits.tomorrowTo);
		window = window.filter((h) => String(h.time).slice(0, 10) === String(window[0]?.time).slice(0, 10));
	}
	if (window.length === 0) return null;

	const prefix = when === "tomorrow" ? "Tomorrow: " : "";
	const rainy = window.find((h) => h.precip >= limits.rainPct);
	if (rainy) {
		const start = rainy === window[0] && when === "today" ? "now" : `from ${hourLabel(rainy.hour)}`;
		return { tone: "warn", when, text: `${prefix}rain likely ${start}` };
	}
	const windiest = window.reduce((a, b) => (b.wind > a.wind ? b : a));
	if (windiest.wind >= limits.windKmh) {
		return { tone: "warn", when, text: `${prefix}windy, up to ${Math.round(windiest.wind)} km/h` };
	}
	const high = Math.max(...window.map((h) => h.temp));
	if (high < limits.coldC) {
		return { tone: "warn", when, text: `${prefix}cold, ${Math.round(high)}° at best` };
	}
	if (high >= limits.hotC) {
		return { tone: "warn", when, text: `${prefix}hot, up to ${Math.round(high)}°` };
	}
	const until = when === "today" && sunsetLocal
		? ` until sunset, ${hourLabel(Number(String(sunsetLocal).slice(11, 13)), Number(String(sunsetLocal).slice(14, 16)))}`
		: "";
	return { tone: "good", when, text: `${prefix}good riding weather${until}` };
}
