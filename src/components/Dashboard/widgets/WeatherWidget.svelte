<!--
    Current conditions + sun arc + moon phase. Geolocates (falls back to
    Toronto), fetches Open-Meteo + AQI + reverse-geocode in parallel, and
    pushes sunrise/sunset/daylight-delta into the shared sun store so the
    Clock widget can render the delta.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import { location, sun } from "../lib/stores.svelte.js";
    import { createPoller } from "../../../lib/data/poller.js";

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

    const MOON_PHASES = [
        { emoji: "🌑", name: "New Moon" },
        { emoji: "🌒", name: "Waxing Crescent" },
        { emoji: "🌓", name: "First Quarter" },
        { emoji: "🌔", name: "Waxing Gibbous" },
        { emoji: "🌕", name: "Full Moon" },
        { emoji: "🌖", name: "Waning Gibbous" },
        { emoji: "🌗", name: "Last Quarter" },
        { emoji: "🌘", name: "Waning Crescent" },
    ];

    let temp = $state("—°");
    let cond = $state("—");
    let meta = $state("Locating…");
    let feels = $state("—");
    let wind = $state("—");
    let uv = $state("—");
    let aqi = $state("—");
    let sunriseLabel = $state("—");
    let sunsetLabel = $state("—");
    let sunNow = $state(new Date());
    let moon = $state(moonPhaseFor(new Date()));

    let stopWeatherPoll;
    let sunTickTimer;
    let moonTimer;

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

    function moonPhaseFor(date) {
        const knownNew = Date.UTC(2000, 0, 6, 18, 14);
        const days = (date.getTime() - knownNew) / 86400000;
        let p = (days / 29.530588853) % 1;
        if (p < 0) p += 1;
        const illumination = (1 - Math.cos(p * 2 * Math.PI)) / 2;
        const idx = Math.round(p * 8) % 8;
        return { phase: p, illumination, ...MOON_PHASES[idx] };
    }

    async function fetchJSON(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch failed: ${url}`);
        return res.json();
    }

    async function loadWeather(lat, lon) {
        try {
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,apparent_temperature,wind_speed_10m,uv_index&daily=sunrise,sunset&past_days=1&timezone=auto&wind_speed_unit=kmh`;
            const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`;
            const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
            const [weather, aqiR, geo] = await Promise.allSettled([
                fetchJSON(weatherUrl), fetchJSON(aqiUrl), fetchJSON(geoUrl),
            ]);
            if (weather.status !== "fulfilled") throw new Error("weather failed");
            const c = weather.value.current;
            const [label, emoji] = WMO[c.weather_code] || ["—", ""];
            temp = Math.round(c.temperature_2m) + "°";
            cond = `${emoji} ${label}`;
            feels = Math.round(c.apparent_temperature) + "°";
            wind = Math.round(c.wind_speed_10m) + " km/h";
            uv = uvBand(c.uv_index);
            if (aqiR.status === "fulfilled") aqi = aqiBand(aqiR.value.current?.european_aqi);
            let cityLabel = null;
            if (geo.status === "fulfilled") {
                const g = geo.value;
                const place = g.city || g.locality || g.principalSubdivision;
                const region = g.principalSubdivision && place !== g.principalSubdivision
                    ? g.principalSubdivision
                    : g.countryName;
                if (place && region) cityLabel = `${place}, ${region}`;
                else if (place) cityLabel = place;
            }
            meta = cityLabel || "Location unavailable";

            const daily = weather.value.daily;
            if (daily) {
                const todayKey = new Date().toISOString().slice(0, 10);
                const todayIdx = (daily.time || []).findIndex((t) => String(t).slice(0, 10) === todayKey);
                const tIdx = todayIdx >= 0 ? todayIdx : 0;
                sun.sunrise = new Date(daily.sunrise[tIdx]);
                sun.sunset = new Date(daily.sunset[tIdx]);
                sunriseLabel = sun.sunrise.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                sunsetLabel = sun.sunset.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                if (tIdx > 0 && daily.sunrise[tIdx - 1] && daily.sunset[tIdx - 1]) {
                    const todayLen = (new Date(daily.sunset[tIdx]) - new Date(daily.sunrise[tIdx])) / 1000;
                    const yestLen = (new Date(daily.sunset[tIdx - 1]) - new Date(daily.sunrise[tIdx - 1])) / 1000;
                    sun.daylightDeltaSeconds = Math.round(todayLen - yestLen);
                }
            }
        } catch {
            meta = "Unable to load weather";
        }
    }

    function acquireLocation() {
        if (!navigator.geolocation) {
            location.lat = 43.6532; location.lon = -79.3832;
            meta = "Geolocation unsupported";
            loadWeather(location.lat, location.lon);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                location.lat = pos.coords.latitude;
                location.lon = pos.coords.longitude;
                loadWeather(location.lat, location.lon);
            },
            () => {
                location.lat = 43.6532; location.lon = -79.3832;
                loadWeather(location.lat, location.lon);
            },
            { enableHighAccuracy: false, maximumAge: 1000 * 60 * 10, timeout: 8000 },
        );
    }

    function bezierPoint(t, p0, p1, p2) {
        const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
        const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
        return [x, y];
    }

    const sunDot = $derived.by(() => {
        if (!sun.sunrise || !sun.sunset) return { cx: 100, cy: 35, opacity: 0.25 };
        const total = sun.sunset - sun.sunrise;
        const elapsed = sunNow - sun.sunrise;
        const t = Math.max(0, Math.min(1, elapsed / total));
        const [x, y] = bezierPoint(t, [10, 80], [100, -20], [190, 80]);
        const opacity = (sunNow < sun.sunrise || sunNow > sun.sunset) ? 0.25 : 1;
        return { cx: x.toFixed(2), cy: y.toFixed(2), opacity };
    });

    onMount(() => {
        acquireLocation();
        // Only the weather fetch is visibility-aware (the network poll). The
        // sun-position tick and moon-phase recompute are local-only and cheap,
        // so they keep running. (Geolocation is requested once on mount.)
        stopWeatherPoll = createPoller(() => {
            if (location.lat != null) loadWeather(location.lat, location.lon);
        }, 1000 * 60 * 15, { jitterMs: 30_000 });
        sunTickTimer = setInterval(() => { sunNow = new Date(); }, 1000);
        moonTimer = setInterval(() => { moon = moonPhaseFor(new Date()); }, 1000 * 60 * 60);
    });
    onDestroy(() => {
        stopWeatherPoll?.();
        clearInterval(sunTickTimer);
        clearInterval(moonTimer);
    });
</script>

<div class="weather-left">
    <div class="widget-label">Weather</div>
    <div class="weather-temp">{temp}</div>
    <div class="weather-cond">{cond}</div>
    <div class="weather-meta">{meta}</div>
    <div class="weather-stats">
        <div><div class="weather-stat-label">Feels</div><div class="weather-stat-value">{feels}</div></div>
        <div><div class="weather-stat-label">Wind</div><div class="weather-stat-value">{wind}</div></div>
        <div><div class="weather-stat-label">UV</div><div class="weather-stat-value">{uv}</div></div>
        <div><div class="weather-stat-label">Air</div><div class="weather-stat-value">{aqi}</div></div>
    </div>
</div>
<div class="weather-right">
    <div class="widget-label">Sun and moon</div>
    <svg class="sun-svg" viewBox="0 0 200 90" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <line class="sun-horizon" x1="0" y1="80" x2="200" y2="80"/>
        <path class="sun-arc" d="M 10 80 Q 100 -20, 190 80"/>
        <circle class="sun-dot" cx={sunDot.cx} cy={sunDot.cy} r="5" style:opacity={sunDot.opacity}/>
    </svg>
    <div class="sun-times">
        <span><span class="sun-times-label">Sunrise</span>{sunriseLabel}</span>
        <span><span class="sun-times-label">Sunset</span>{sunsetLabel}</span>
    </div>
    <div class="moon-info">
        <div class="moon-emoji">{moon.emoji}</div>
        <div class="moon-text">
            <div class="moon-name">{moon.name}</div>
            <div class="moon-illum">{Math.round(moon.illumination * 100)}% illuminated</div>
        </div>
    </div>
</div>

<style>
    .weather-left,
    .weather-right {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: var(--space-2);
    }
    .weather-right { flex: 1.25; }
    .weather-temp {
        margin-top: var(--space-1);
        font-size: clamp(2rem, 4vw, 3.5rem);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.04em;
        line-height: 1;
        color: var(--text-strong);
    }
    .weather-cond { font-size: var(--font-md); color: var(--text-strong); }
    .weather-meta { font-size: var(--font-xs); color: var(--text-3); }
    .weather-stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-2) var(--space-4);
        margin-top: var(--space-2);
        padding-top: var(--space-3);
        border-top: 1px solid var(--border);
        font-size: var(--font-sm);
    }
    .weather-stat-label { font-size: var(--font-2xs); color: var(--text-2); }
    .weather-stat-value { font-weight: var(--weight-medium); color: var(--text-strong); }

    .sun-svg {
        flex-shrink: 0;
        width: 100%;
        height: auto;
        max-height: 110px;
        margin: var(--space-1) 0 var(--space-2);
    }
    @container slot (max-width: 560px) {
        .weather-stats { grid-template-columns: 1fr 1fr; }
    }
    @container slot (min-height: 380px) {
        .weather-temp { font-size: clamp(2.5rem, 5.5vw, 4.5rem); }
        .sun-svg { max-height: 150px; }
    }
    .sun-svg :global(path.sun-arc) {
        fill: none;
        stroke: var(--border-strong);
        stroke-width: 1.4;
        stroke-dasharray: 3 4;
        vector-effect: non-scaling-stroke;
    }
    .sun-svg :global(circle.sun-dot) { fill: var(--tone-warn); }
    .sun-svg :global(line.sun-horizon) { stroke: var(--border-strong); stroke-width: 1; }
    .sun-times {
        display: flex;
        justify-content: space-between;
        font-size: var(--font-sm);
        font-variant-numeric: tabular-nums;
        color: var(--text-strong);
    }
    .sun-times > span { display: flex; flex-direction: column; }
    .sun-times > span:last-child { text-align: right; }
    .sun-times-label { font-size: var(--font-2xs); color: var(--text-2); }
    .moon-info {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-top: var(--space-2);
        padding-top: var(--space-3);
        border-top: 1px solid var(--border);
    }
    .moon-emoji { font-size: 1.5rem; line-height: 1; }
    .moon-text { display: flex; flex-direction: column; min-width: 0; }
    .moon-name { font-size: var(--font-sm); font-weight: var(--weight-medium); color: var(--text-strong); }
    .moon-illum { font-size: var(--font-xs); color: var(--text-2); }
</style>
