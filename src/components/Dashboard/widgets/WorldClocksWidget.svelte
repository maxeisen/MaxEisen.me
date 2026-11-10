<!--
    The time in a few other places, with how far each is from here and
    whether it's already tomorrow (or still yesterday) there. All in the
    browser; nothing to fetch. The zones come from the registry entry.

    Size tiers (container queries on the slot): one row of clocks when
    there's width, two when narrow; the offset line goes in a strip.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import WidgetHeader from "./WidgetHeader.svelte";

    let { zones = [] } = $props();

    let now = $state(new Date());
    let timer;

    // Minutes east of UTC for a zone at an instant, from the zone's own
    // wall clock: no offset table to keep up to date with DST rules.
    function offsetMinutes(timeZone, date) {
        const parts = Object.fromEntries(
            new Intl.DateTimeFormat("en-US", {
                timeZone,
                hourCycle: "h23",
                year: "numeric", month: "numeric", day: "numeric",
                hour: "numeric", minute: "numeric",
            }).formatToParts(date).map((p) => [p.type, p.value]),
        );
        const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
        return Math.round((wall - Math.floor(date.getTime() / 60000) * 60000) / 60000);
    }

    function dayKey(timeZone, date) {
        return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    }

    function relative(minutes) {
        if (minutes === 0) return "same time";
        const sign = minutes > 0 ? "+" : "−";
        const abs = Math.abs(minutes);
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        return `${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}h`;
    }

    const here = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const clocks = $derived(
        zones.map(({ zone, label }) => {
            const diff = offsetMinutes(zone, now) - offsetMinutes(here, now);
            const there = dayKey(zone, now);
            const home = dayKey(here, now);
            return {
                zone,
                label,
                time: now.toLocaleTimeString([], { timeZone: zone, hour: "numeric", minute: "2-digit" }),
                offset: relative(diff),
                day: there > home ? "tomorrow" : there < home ? "yesterday" : "",
            };
        }),
    );

    onMount(() => {
        // Minutes are all that's shown; a tick every 15s keeps the turn of
        // the minute prompt without a per-second render.
        timer = setInterval(() => { now = new Date(); }, 15_000);
    });
    onDestroy(() => clearInterval(timer));
</script>

<WidgetHeader label="World clocks" />

<ul class="wc">
    {#each clocks as clock (clock.zone)}
        <li class="wc-item">
            <span class="wc-label">{clock.label}</span>
            <span class="wc-time">{clock.time}</span>
            <span class="wc-offset">{clock.offset}{#if clock.day} · {clock.day}{/if}</span>
        </li>
    {/each}
</ul>

<style>
    .wc {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
        grid-auto-flow: column;
        align-content: center;
        gap: var(--space-2) var(--space-4);
        flex: 1;
        min-height: 0;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .wc-item { display: flex; flex-direction: column; min-width: 0; }
    .wc-label { font-size: var(--font-xs); color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wc-time {
        font-size: clamp(1.1rem, min(6cqi, 22cqh), 1.9rem);
        font-weight: var(--weight-semibold);
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.02em;
        line-height: 1.15;
        white-space: nowrap;
        color: var(--text-strong);
    }
    .wc-offset { font-size: var(--font-2xs); color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    @container slot (max-width: 380px) {
        .wc { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .wc-time { font-size: clamp(1rem, 9cqi, 1.5rem); }
    }
    @container slot (max-width: 380px) and (max-height: 180px) {
        .wc-item:nth-child(n + 3) { display: none; }
    }
    @container slot (max-height: 110px) {
        .wc-offset { display: none; }
    }
</style>
