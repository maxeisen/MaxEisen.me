<!--
    Recent activity of every kind from Strava — runs, rides, walks, hikes —
    with a route preview (when a route shape is available) or an icon. The
    Running and Cycling widgets cover the training side; this one is the
    feed, and links to Strava itself. Reports itself unavailable if the feed never loads (or
    the function isn't configured, 503). List is
    trimmed to whatever fits the slot, so no partial rows are shown; the
    year-to-date footer only appears when the slot is wide and tall enough
    to spare it.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import { timeAgo, trimListToFit } from "../lib/utils.js";
    import { isFetchErrorStatus } from "../../../lib/data/fetchJson.js";
    import { createPoller } from "../../../lib/data/poller.js";
    import { createSWRWidgetFeed } from "../lib/widgetFeed.js";
    import { bindTrimOnResize } from "../lib/listResize.js";
    import { listLoadState, listStateMessage } from "../lib/listState.js";
    import WidgetHeader from "./WidgetHeader.svelte";
    import Spinner from "../../../lib/ui/Spinner.svelte";
    import {
        STRAVA_ICONS,
        STRAVA_FEED_URL,
        STRAVA_PROFILE_URL,
        formatDistance,
        formatDuration,
        formatPace,
        routeToSvgPath,
    } from "../../../lib/strava.js";

    let { onavailability = () => {} } = $props();

    let listEl = $state();
    let activities = $state(null); // null = loading
    let ytd = $state(null); // { run, ride } YTD totals, or null
    let stopPoll;
    let stopResizeTrim;

    // Whole-km, comma-grouped — YTD distances are large enough that
    // decimals are noise (e.g. "1,250 km").
    function ytdKm(m) {
        if (m == null) return "0 km";
        return `${Math.round(m / 1000).toLocaleString()} km`;
    }
    const activitiesState = $derived(listLoadState(activities));
    const activitiesMessage = $derived(listStateMessage(activitiesState, "Loading…", "Strava unavailable"));

    function applyFeed(data) {
        onavailability(true);
        // More than a small tile shows; trimming hides whatever doesn't fit,
        // so a tall tile fills up instead of ending in blank space.
        activities = (data?.activities || []).slice(0, 10);
        ytd = data?.ytd || null;
        requestAnimationFrame(() => trimListToFit(listEl));
    }
    // Fetch the wider feed (limit=30) so this URL is identical to the one the
    // intro modals already use. Gear and YTD ride on the same
    // snapshot, so a second stravaProfile call is not required.
    const feed = createSWRWidgetFeed({
        url: STRAVA_FEED_URL,
        apply: applyFeed,
        // A failure after a good load keeps the last activities up.
        onError: (e) => {
            if (activities === null || isFetchErrorStatus(e, 503)) onavailability(false);
        },
    });

    onMount(() => {
        feed.load();
        // Poll the feed on the 5-min cadence. Pause while hidden.
        stopPoll = createPoller(() => { feed.load(); }, 1000 * 60 * 5, { jitterMs: 15_000 });
        stopResizeTrim = bindTrimOnResize(listEl);
    });
    onDestroy(() => {
        stopPoll?.();
        stopResizeTrim?.();
    });
</script>

<WidgetHeader profileHref={STRAVA_PROFILE_URL} profileLabel="Strava" label="Activity" />
<ol class="strava-list" bind:this={listEl}>
    {#if activitiesState === "loading"}
        <li class="widget-loading" role="status" aria-label="Loading">
            <Spinner size={24} stroke={2} />
        </li>
    {:else if activitiesMessage}
        <li class="widget-empty">{activitiesMessage}</li>
    {:else}
        {#each activities as a (a.id ?? a.startDate ?? a.name)}
            {@const icon = STRAVA_ICONS[a.type] || "🏃"}
            {@const pace = formatPace(a.distance, a.movingTime, a.type)}
            {@const url = a.id ? `https://www.strava.com/activities/${a.id}` : "#"}
            {@const path = routeToSvgPath(a.route)}
            {@const metaBits = [a.type, a.startDate ? timeAgo(a.startDate) : null, a.sufferScore != null ? `Effort ${Math.round(a.sufferScore)}` : null].filter(Boolean)}
            <li>
                <a class="strava-row no-ext-arrow" href={url} target="_blank" rel="noreferrer">
                    {#if path}
                        <svg class="strava-row-map" viewBox="0 0 56 38" aria-hidden="true"><path d={path}/></svg>
                    {:else}
                        <div class="strava-row-icon">{icon}</div>
                    {/if}
                    <div class="strava-row-main">
                        <div class="strava-row-name">{a.name || a.type || "Activity"}</div>
                        <div class="strava-row-meta">{metaBits.join(" · ")}</div>
                    </div>
                    <div class="strava-row-stats">
                        <div>
                            <strong>{formatDistance(a.distance)}</strong>
                            <span>{pace || formatDuration(a.movingTime)}</span>
                        </div>
                    </div>
                </a>
            </li>
        {/each}
    {/if}
</ol>

{#if ytd && (ytd.run || ytd.ride)}
    <!-- Year-to-date summary. Hidden in small slots via the container
         query below; shown when the slot has room to spare. -->
    <div class="strava-ytd">
        <span class="strava-ytd-label">{new Date().getFullYear()} to date</span>
        <div class="strava-ytd-stats">
            {#if ytd.run}
                <span class="strava-ytd-item">
                    <strong>{ytdKm(ytd.run.distance)}</strong>
                    <span class="strava-ytd-count">running · {ytd.run.count} runs</span>
                </span>
            {/if}
            {#if ytd.ride}
                <span class="strava-ytd-item">
                    <strong>{ytdKm(ytd.ride.distance)}</strong>
                    <span class="strava-ytd-count">cycling · {ytd.ride.count} rides</span>
                </span>
            {/if}
        </div>
    </div>
{/if}

<style>
    .strava-list {
        list-style: none;
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        margin: 0;
        padding: 0;
        overflow: hidden;
    }
    .strava-list li + li { border-top: 1px solid var(--border); }
    .strava-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2) 0;
        color: inherit;
    }
    .strava-row:hover .strava-row-name { color: var(--accent); }
    .strava-row-icon,
    .strava-row-map {
        flex-shrink: 0;
        height: 36px;
        border-radius: var(--radius);
        background: var(--surface-2);
    }
    .strava-row-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        font-size: 1.1rem;
    }
    .strava-row-map { display: block; width: 52px; padding: 4px; }
    .strava-row-map :global(path) {
        fill: none;
        stroke: var(--series-1);
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    .strava-row-main { flex: 1; min-width: 0; }
    .strava-row-name {
        font-size: var(--font-sm);
        font-weight: var(--weight-medium);
        color: var(--text-strong);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color var(--dur-fast) var(--ease);
    }
    .strava-row-meta { margin-top: 1px; font-size: var(--font-xs); color: var(--text-2); }
    .strava-row-stats {
        display: flex;
        flex-shrink: 0;
        text-align: right;
        font-variant-numeric: tabular-nums;
    }
    .strava-row-stats strong {
        display: block;
        font-size: var(--font-sm);
        font-weight: var(--weight-semibold);
        line-height: 1.3;
        color: var(--text-strong);
    }
    .strava-row-stats span { font-size: var(--font-2xs); color: var(--text-3); }

    /* Year to date. Only where the slot has the room to lay it out; in a
       small slot the activity list keeps the room. */
    .strava-ytd {
        display: none;
        flex-direction: column;
        flex-shrink: 0;
        gap: var(--space-1);
        margin-top: var(--space-2);
        padding-top: var(--space-3);
        border-top: 1px solid var(--border);
    }
    @container slot (min-width: 420px) and (min-height: 280px) {
        .strava-ytd { display: flex; }
    }
    @container slot (max-height: 240px) {
        .strava-row { padding: 6px 0; }
    }
    @container slot (max-width: 300px) {
        .strava-row-map,
        .strava-row-icon { display: none; }
    }
    .strava-ytd-label { font-size: var(--font-xs); color: var(--text-2); }
    .strava-ytd-stats { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-6); }
    .strava-ytd-item { display: inline-flex; align-items: baseline; gap: var(--space-2); }
    .strava-ytd-item strong {
        font-size: var(--font-lg);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.01em;
        color: var(--text-strong);
    }
    .strava-ytd-count { font-size: var(--font-xs); color: var(--text-3); }
</style>
