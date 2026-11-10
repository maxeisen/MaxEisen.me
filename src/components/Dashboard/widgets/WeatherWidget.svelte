<!--
    Current conditions + sun arc + moon phase. The data comes from the shared
    weather feed (lib/weatherFeed), which the Clock also subscribes to for its
    daylight line; this widget only adds the sun's position and the moon.

    Size tiers (container queries on the slot), from roomy to cramped:
    conditions beside sun-and-moon; then stacked, with sun-and-moon dropped;
    then the stats go, then the location line.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import { sun } from "../lib/stores.svelte.js";
    import { weather, subscribeWeather } from "../lib/weatherFeed.svelte.js";

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

    let { onavailability = () => {} } = $props();

    $effect(() => {
        if (weather.status !== "loading") onavailability(weather.status === "ready");
    });

    let sunNow = $state(new Date());
    let moon = $state(moonPhaseFor(new Date()));

    let unsubscribe;
    let sunTickTimer;
    let moonTimer;

    function moonPhaseFor(date) {
        const knownNew = Date.UTC(2000, 0, 6, 18, 14);
        const days = (date.getTime() - knownNew) / 86400000;
        let p = (days / 29.530588853) % 1;
        if (p < 0) p += 1;
        const illumination = (1 - Math.cos(p * 2 * Math.PI)) / 2;
        const idx = Math.round(p * 8) % 8;
        return { phase: p, illumination, ...MOON_PHASES[idx] };
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
        unsubscribe = subscribeWeather();
        // The sun-position tick and moon-phase recompute are local and cheap,
        // so they keep running while the tab is hidden; only the feed's
        // network poll is visibility-aware.
        sunTickTimer = setInterval(() => { sunNow = new Date(); }, 1000);
        moonTimer = setInterval(() => { moon = moonPhaseFor(new Date()); }, 1000 * 60 * 60);
    });
    onDestroy(() => {
        unsubscribe?.();
        clearInterval(sunTickTimer);
        clearInterval(moonTimer);
    });
</script>

<div class="weather">
    <div class="weather-left">
        <div class="widget-label">Weather</div>
        <div class="weather-temp">{weather.temp}</div>
        <div class="weather-cond">{weather.cond}</div>
        <div class="weather-meta">{weather.meta}</div>
        <div class="weather-stats">
            <div><div class="weather-stat-label">Feels</div><div class="weather-stat-value">{weather.feels}</div></div>
            <div><div class="weather-stat-label">Wind</div><div class="weather-stat-value">{weather.wind}</div></div>
            <div><div class="weather-stat-label">UV</div><div class="weather-stat-value">{weather.uv}</div></div>
            <div><div class="weather-stat-label">Air</div><div class="weather-stat-value">{weather.aqi}</div></div>
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
            <span><span class="sun-times-label">Sunrise</span>{weather.sunriseLabel}</span>
            <span><span class="sun-times-label">Sunset</span>{weather.sunsetLabel}</span>
        </div>
        <div class="moon-info">
            <div class="moon-emoji">{moon.emoji}</div>
            <div class="moon-text">
                <div class="moon-name">{moon.name}</div>
                <div class="moon-illum">{Math.round(moon.illumination * 100)}% illuminated</div>
            </div>
        </div>
    </div>
</div>

<style>
    .weather {
        display: flex;
        flex: 1;
        gap: clamp(var(--space-4), 4cqi, var(--space-6));
        min-height: 0;
    }
    .weather-left,
    .weather-right {
        flex: 1;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: var(--space-2);
    }
    .weather-right { flex: 1.25; }
    .weather-temp {
        margin-top: var(--space-1);
        font-size: clamp(1.75rem, min(8cqi, 22cqh), 4.5rem);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.04em;
        line-height: 1;
        color: var(--text-strong);
    }
    .weather-cond { font-size: var(--font-md); color: var(--text-strong); }
    .weather-meta { font-size: var(--font-xs); color: var(--text-3); }
    .weather-cond,
    .weather-meta { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .weather-stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-2) var(--space-4);
        margin-top: var(--space-2);
        padding-top: var(--space-3);
        border-top: 1px solid var(--border);
        font-size: var(--font-sm);
    }
    .weather-stats > div { min-width: 0; }
    .weather-stat-label { font-size: var(--font-2xs); color: var(--text-2); }
    .weather-stat-value {
        font-weight: var(--weight-medium);
        color: var(--text-strong);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .sun-svg {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        max-height: 150px;
        margin: var(--space-1) 0 var(--space-2);
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

    /* Two stats to a row once four would crowd each other. */
    @container slot (max-width: 640px) {
        .weather-stats { grid-template-columns: 1fr 1fr; }
    }
    /* The moon goes before the sun arc does. */
    @container slot (max-height: 300px) {
        .moon-info { display: none; }
    }
    /* Too narrow or short for two columns: conditions only. */
    @container slot (max-width: 460px) or (max-height: 240px) {
        .weather-right { display: none; }
        .weather-left { justify-content: flex-start; gap: var(--space-1); }
        .weather-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
    @container slot (max-width: 340px) {
        .weather-stats { grid-template-columns: 1fr 1fr; }
    }
    @container slot (max-height: 240px) {
        .weather-stats { margin-top: auto; padding-top: var(--space-2); }
    }
    @container slot (max-height: 190px) {
        .weather-stats { display: none; }
    }
    @container slot (max-height: 130px) {
        .weather-meta { display: none; }
    }
</style>
