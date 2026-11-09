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
    const greeting = $derived(greetingFor(now.getHours()));
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
        <div class="clock-progress-label"><span>Work day</span><span class="clock-progress-pct">{formatPct(dayPct)}</span></div>
        <div class="clock-progress-bar"><div class="clock-progress-fill" style:width={formatWidth(dayPct)}></div></div>
    </div>
    <div class="clock-progress-item">
        <div class="clock-progress-label"><span>Work week</span><span class="clock-progress-pct">{formatPct(weekPct)}</span></div>
        <div class="clock-progress-bar"><div class="clock-progress-fill" style:width={formatWidth(weekPct)}></div></div>
    </div>
    <div class="clock-progress-item">
        <div class="clock-progress-label"><span>Year</span><span class="clock-progress-pct">{formatPct(yearPct)}</span></div>
        <div class="clock-progress-bar"><div class="clock-progress-fill" style:width={formatWidth(yearPct)}></div></div>
    </div>
</div>

<style>
    .clock-time {
        font-weight: var(--weight-semibold);
        font-variant-numeric: tabular-nums;
        font-size: min(clamp(3rem, 12vw, 10rem), 36cqh);
        line-height: 1;
        letter-spacing: -0.045em;
        color: var(--text-strong);
    }
    .clock-meridiem {
        margin-left: 0.35em;
        font-size: clamp(0.9rem, 1.4vw, 1.3rem);
        font-weight: var(--weight-medium);
        letter-spacing: 0;
        color: var(--text-3);
        vertical-align: 0.15em;
    }
    .clock-meta {
        display: flex;
        align-items: baseline;
        justify-content: center;
        flex-wrap: wrap;
        gap: var(--space-3);
        margin-top: var(--space-1);
    }
    .clock-greeting {
        font-size: clamp(1.05rem, 1.6vw, 1.5rem);
        font-weight: var(--weight-medium);
        letter-spacing: -0.015em;
        color: var(--text-strong);
    }
    .clock-date { font-size: var(--font-sm); color: var(--text-2); }
    .clock-daylight {
        font-size: var(--font-xs);
        font-variant-numeric: tabular-nums;
        color: var(--text-3);
    }
    .clock-progress {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--space-5);
        width: 100%;
        max-width: 540px;
        margin-top: var(--space-5);
    }
    .clock-progress-item { display: flex; flex-direction: column; gap: 6px; }
    .clock-progress-label {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-size: var(--font-xs);
        color: var(--text-2);
    }
    .clock-progress-pct {
        font-weight: var(--weight-semibold);
        font-variant-numeric: tabular-nums;
        color: var(--text-strong);
    }
    .clock-progress-bar {
        height: 4px;
        border-radius: var(--radius-pill);
        background: var(--surface-2);
        overflow: hidden;
    }
    .clock-progress-fill {
        height: 100%;
        border-radius: var(--radius-pill);
        background: var(--series-1);
        transition: width 0.4s var(--ease);
    }
    @media (max-width: 700px) {
        .clock-progress { gap: var(--space-3); }
    }
</style>
