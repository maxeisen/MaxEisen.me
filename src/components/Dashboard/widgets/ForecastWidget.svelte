<!--
    The next hours and days, from the same Open-Meteo forecast the Weather
    widget reads (lib/weatherFeed), plus a one-line verdict on whether it's a
    day for a ride (lib/rideWeather).

    Size tiers (container queries on the slot): the hour strip shows as many
    hours as fit across; the five-day row appears once there's height for it,
    and the verdict line goes when the slot is a strip.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import WidgetHeader from "./WidgetHeader.svelte";
    import HourStrip from "./HourStrip.svelte";
    import Spinner from "../../../lib/ui/Spinner.svelte";
    import { weather, subscribeWeather, describeCode } from "../lib/weatherFeed.svelte.js";
    import { rideVerdict } from "../lib/rideWeather.js";
    import { weekday } from "../../Activity/lib/format.js";

    let { onavailability = () => {} } = $props();

    $effect(() => {
        if (weather.status !== "loading") onavailability(weather.status === "ready" && weather.hourly.length > 0);
    });

    const verdict = $derived(rideVerdict(weather.hourly, { sunsetLocal: weather.sunsetLocal }));

    let unsubscribe;
    onMount(() => { unsubscribe = subscribeWeather(); });
    onDestroy(() => unsubscribe?.());
</script>

<WidgetHeader label="Forecast" />

{#if !weather.hourly.length}
    <div class="widget-loading" role="status" aria-label="Loading">
        <Spinner size={24} stroke={2} />
    </div>
{:else}
    <div class="fc">
        {#if verdict}
            <p class="fc-verdict" class:warn={verdict.tone === "warn"}>
                <span class="fc-bike" aria-hidden="true">🚲</span>{verdict.text}
            </p>
        {/if}
        <HourStrip hours={weather.hourly} />
        {#if weather.days.length}
            <ol class="fc-days">
                {#each weather.days as day, i (day.date)}
                    <li class="fc-day">
                        <span class="fc-day-name">{i === 0 ? "Today" : weekday(day.date)}</span>
                        <span class="fc-day-sky" title={describeCode(day.code).label}>{describeCode(day.code).emoji}</span>
                        <span class="fc-day-temp"><strong>{Math.round(day.hi)}°</strong> {Math.round(day.lo)}°</span>
                        <span class="fc-day-rain">{day.precip >= 30 ? `${Math.round(day.precip)}%` : ""}</span>
                    </li>
                {/each}
            </ol>
        {/if}
    </div>
{/if}

<style>
    .fc {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: var(--space-2);
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }
    /* Nothing here shrinks: what doesn't fit is dropped by the tiers below,
       rather than squashed. */
    .fc > * { flex: none; }
    .fc-verdict {
        margin: 0;
        font-size: var(--font-sm);
        color: var(--tone-good);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .fc-verdict::first-letter { text-transform: uppercase; }
    .fc-verdict.warn { color: var(--tone-warn); }
    .fc-bike { margin-right: 6px; }
    .fc-days {
        display: none;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-2) 0 0;
        border-top: 1px solid var(--border);
        list-style: none;
    }
    .fc-day {
        display: grid;
        grid-template-columns: auto auto;
        justify-content: start;
        align-items: baseline;
        gap: 0 6px;
        min-width: 0;
        font-variant-numeric: tabular-nums;
    }
    .fc-day-name { grid-column: 1 / -1; font-size: var(--font-2xs); color: var(--text-2); }
    .fc-day-sky { font-size: 1rem; }
    .fc-day-temp { font-size: var(--font-xs); color: var(--text-2); white-space: nowrap; }
    .fc-day-temp strong { font-weight: var(--weight-semibold); color: var(--text-strong); }
    .fc-day-rain { grid-column: 1 / -1; min-height: 1em; font-size: var(--font-2xs); color: var(--series-2); }

    @container slot (min-height: 250px) {
        .fc-days { display: grid; }
    }
    @container slot (max-width: 360px) {
        .fc-day:nth-child(n + 4) { display: none; }
        .fc-days { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @container slot (max-height: 175px) {
        .fc :global(.hour-rain) { display: none; }
    }
    @container slot (max-height: 135px) {
        .fc :global(.hour-sky) { display: none; }
    }
    /* The verdict's bike says what this is; the label row can go first. */
    @container slot (max-height: 135px) {
        :global(.widget-forecast .widget-head) { display: none; }
    }
    @container slot (max-height: 110px) {
        .fc-verdict { display: none; }
    }
</style>
