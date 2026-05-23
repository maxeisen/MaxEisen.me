<!--
    Clock + date + greeting + work-day/work-week/year progress bars + daylight
    delta. Ticks every second. Daylight delta is sourced from the sun store
    (populated by the weather widget once forecast data arrives).
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import { pad } from "../lib/utils.js";
    import { sun } from "../lib/stores.svelte.js";

    const WORKDAY_START_HOUR = 9;
    const WORKDAY_END_HOUR = 17;

    let now = $state(new Date());
    let timer;

    function greetingFor(hour) {
        if (hour < 5) return "Late night";
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        if (hour < 21) return "Good evening";
        return "Late night";
    }

    function dayProgress(d) {
        const start = new Date(d); start.setHours(WORKDAY_START_HOUR, 0, 0, 0);
        const end = new Date(d); end.setHours(WORKDAY_END_HOUR, 0, 0, 0);
        return Math.max(0, Math.min(1, (d - start) / (end - start)));
    }
    function weekProgress(d) {
        const day = d.getDay();
        if (day === 0 || day === 6) return 1;
        const monday = new Date(d);
        monday.setDate(d.getDate() - day + 1);
        monday.setHours(WORKDAY_START_HOUR, 0, 0, 0);
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);
        friday.setHours(WORKDAY_END_HOUR, 0, 0, 0);
        if (d < monday) return 0;
        return Math.min(1, (d - monday) / (friday - monday));
    }
    function yearProgress(d) {
        const start = new Date(d.getFullYear(), 0, 1);
        const end = new Date(d.getFullYear() + 1, 0, 1);
        return (d - start) / (end - start);
    }

    const hr12 = $derived(((now.getHours() + 11) % 12) + 1);
    const timeStr = $derived(`${pad(hr12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
    const meridiem = $derived(now.getHours() < 12 ? "AM" : "PM");
    const greeting = $derived(greetingFor(now.getHours()) + ".");
    const dateStr = $derived(now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
    const dayPct = $derived(dayProgress(now));
    const weekPct = $derived(weekProgress(now));
    const yearPct = $derived(yearProgress(now));

    const daylightLabel = $derived.by(() => {
        const seconds = sun.daylightDeltaSeconds;
        if (!Number.isFinite(seconds)) return null;
        if (seconds === 0) return "Same daylight as yesterday";
        const sign = seconds > 0 ? "+" : "−";
        const abs = Math.abs(seconds);
        const m = Math.floor(abs / 60);
        const s = abs % 60;
        const len = m > 0 ? `${m}m ${s}s` : `${s}s`;
        return `${sign}${len} of daylight today`;
    });

    function formatPct(p) { return (p * 100).toFixed(p === 1 || p === 0 ? 0 : 1) + "%"; }
    function formatWidth(p) { return (p * 100).toFixed(2) + "%"; }

    onMount(() => {
        timer = setInterval(() => { now = new Date(); }, 1000);
    });
    onDestroy(() => clearInterval(timer));
</script>

<div class="clock-time">{timeStr}<span class="clock-meridiem">{meridiem}</span></div>
<div class="clock-meta">
    <div class="clock-greeting">{greeting}</div>
    <div class="clock-date">{dateStr}</div>
</div>
{#if daylightLabel}
    <div class="clock-daylight">{daylightLabel}</div>
{/if}
<div class="clock-progress">
    <div class="clock-progress-item">
        <div class="clock-progress-label"><span>Work Day</span><span class="clock-progress-pct">{formatPct(dayPct)}</span></div>
        <div class="clock-progress-bar"><div class="clock-progress-fill" style:width={formatWidth(dayPct)}></div></div>
    </div>
    <div class="clock-progress-item">
        <div class="clock-progress-label"><span>Work Week</span><span class="clock-progress-pct">{formatPct(weekPct)}</span></div>
        <div class="clock-progress-bar"><div class="clock-progress-fill" style:width={formatWidth(weekPct)}></div></div>
    </div>
    <div class="clock-progress-item">
        <div class="clock-progress-label"><span>Year</span><span class="clock-progress-pct">{formatPct(yearPct)}</span></div>
        <div class="clock-progress-bar"><div class="clock-progress-fill" style:width={formatWidth(yearPct)}></div></div>
    </div>
</div>

<style>
    .clock-time {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-feature-settings: "tnum";
        font-size: min(clamp(3rem, 12vw, 11rem), 36cqh);
        line-height: 1;
        letter-spacing: -0.04em;
        color: var(--header-colour);
    }
    .clock-meridiem {
        font-family: 'Fraunces', serif;
        font-weight: 500;
        font-size: clamp(0.9rem, 1.4vw, 1.4rem);
        margin-left: 0.4em;
        color: var(--main-green);
        vertical-align: middle;
    }
    .clock-meta {
        display: flex;
        align-items: baseline;
        gap: 1rem;
        flex-wrap: wrap;
        justify-content: center;
        margin-top: 0.25rem;
    }
    .clock-greeting {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-size: clamp(1.1rem, 1.9vw, 1.9rem);
        letter-spacing: -0.02em;
        color: var(--header-colour);
    }
    .clock-date {
        font-size: 0.95rem;
        color: var(--paragraph-colour);
        opacity: 0.7;
    }
    .clock-daylight {
        margin-top: 0.4rem;
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--main-green);
        opacity: 0.75;
        font-feature-settings: "tnum";
    }
    .clock-progress {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        width: 100%;
        max-width: 540px;
        margin-top: 1.5rem;
    }
    .clock-progress-item { display: flex; flex-direction: column; gap: 0.35rem; }
    .clock-progress-label {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--main-green);
    }
    .clock-progress-pct {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-size: 1rem;
        letter-spacing: -0.02em;
        color: var(--header-colour);
        text-transform: none;
    }
    .clock-progress-bar {
        height: 3px;
        background: var(--main-green-translucent);
        border-radius: 999px;
        overflow: hidden;
    }
    .clock-progress-fill {
        height: 100%;
        background: var(--main-green);
        border-radius: 999px;
        transition: width 0.4s ease-out;
    }
    @media (max-width: 700px) {
        .clock-progress { gap: 0.6rem; }
    }
</style>
