<!--
    Recent Strava activities with route preview (when polyline available) or
    icon fallback. Hides itself if backing function returns 503. List is
    trimmed dynamically so no partial rows are shown.
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
    import {
        STRAVA_ICONS,
        formatDistance,
        formatDuration,
        formatPace,
        polylineToSvgPath,
    } from "../../../lib/strava.js";

    let listEl = $state();
    let hidden = $state(false);
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

    // Year-to-date run + ride totals from the profile endpoint. Strava's
    // stats API only exposes run/ride/swim YTD (no walk total), so this is
    // run + ride. Independent of the activity feed — if it fails, the
    // footer just doesn't render; the activity list is unaffected.
    function applyYtd(data) {
        ytd = data?.ytd || null;
        requestAnimationFrame(() => trimListToFit(listEl));
    }
    const ytdFeed = createSWRWidgetFeed({
        url: "/.netlify/functions/stravaProfile",
        apply: applyYtd,
        onError: () => {}, // keep footer hidden on failure
    });

    function applyFeed(data) {
        activities = (data?.activities || []).slice(0, 5);
        requestAnimationFrame(() => trimListToFit(listEl));
    }
    // Fetch the wider feed (limit=30) so this URL is identical to the one the
    // intro modals + Toronto map already use. SWR serves a re-mount instantly
    // and dedupes; the 5-min poll still revalidates past the 60s window.
    // Slice to 5 client-side for the dashboard's display.
    const feed = createSWRWidgetFeed({
        url: "/.netlify/functions/stravaFeed?limit=30",
        apply: applyFeed,
        onError: (e) => {
            if (isFetchErrorStatus(e, 503)) { hidden = true; return; }
            activities = [];
        },
    });

    onMount(() => {
        feed.load();
        ytdFeed.load();
        // Poll the feed on the 5-min cadence; refresh YTD on resume too so a
        // returning viewer sees current numbers. Both pause while hidden.
        stopPoll = createPoller(() => { feed.load(); ytdFeed.load(); }, 1000 * 60 * 5, { jitterMs: 15_000 });
        stopResizeTrim = bindTrimOnResize(listEl);
    });
    onDestroy(() => {
        stopPoll?.();
        stopResizeTrim?.();
    });
</script>

{#if !hidden}
    <WidgetHeader profileHref="https://www.strava.com/athletes/92118908" profileLabel="Strava" label="Physical Activity" />
    <ol class="strava-list" bind:this={listEl}>
        {#if activitiesMessage}
            <li class="widget-empty">{activitiesMessage}</li>
        {:else}
            {#each activities as a (a.id ?? a.startDate ?? a.name)}
                {@const icon = STRAVA_ICONS[a.type] || "🏃"}
                {@const pace = formatPace(a.distance, a.movingTime, a.type)}
                {@const url = a.id ? `https://www.strava.com/activities/${a.id}` : "#"}
                {@const path = polylineToSvgPath(a.polyline)}
                {@const metaBits = [a.type, a.startDate ? timeAgo(a.startDate) : null, a.sufferScore != null ? `Effort ${Math.round(a.sufferScore)}` : null].filter(Boolean)}
                <li>
                    <a class="strava-row" href={url} target="_blank" rel="noreferrer">
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
        <!-- Year-to-date summary. Hidden in narrow (small) slots via the
             container query below; shown when the slot has horizontal room. -->
        <div class="strava-ytd">
            <span class="strava-ytd-label">{new Date().getFullYear()} to date</span>
            <div class="strava-ytd-stats">
                {#if ytd.run}
                    <span class="strava-ytd-item">
                        <span class="strava-ytd-icon" aria-hidden="true">🏃</span>
                        <strong>{ytdKm(ytd.run.distance)}</strong>
                        <span class="strava-ytd-count">{ytd.run.count} runs</span>
                    </span>
                {/if}
                {#if ytd.ride}
                    <span class="strava-ytd-item">
                        <span class="strava-ytd-icon" aria-hidden="true">🚴</span>
                        <strong>{ytdKm(ytd.ride.distance)}</strong>
                        <span class="strava-ytd-count">{ytd.ride.count} rides</span>
                    </span>
                {/if}
            </div>
        </div>
    {/if}
{/if}

<style>
    .strava-list {
        list-style: none;
        padding: 0;
        margin: 0.25rem 0 0 0;
        display: flex; flex-direction: column;
        gap: 0.6rem;
        flex: 1; min-height: 0; overflow: hidden;
    }
    .strava-row {
        display: flex; align-items: center; gap: 0.85rem;
        text-decoration: none; color: inherit;
        padding: 0.4rem 0.5rem;
        border-radius: 10px;
        transition: background-color 0.15s ease;
    }
    .strava-row:hover { background: var(--main-green-translucent); }
    .strava-row-icon {
        width: 38px; height: 38px;
        border-radius: 10px;
        background: var(--main-green-translucent);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.4rem;
        flex-shrink: 0;
    }
    .strava-row-map {
        width: 56px; height: 38px;
        flex-shrink: 0;
        background: var(--main-green-translucent);
        border-radius: 10px;
        padding: 4px;
        box-sizing: border-box;
        display: block;
    }
    .strava-row-map :global(path) {
        fill: none;
        stroke: var(--main-green);
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    .strava-row-main { flex: 1; min-width: 0; }
    .strava-row-name {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-size: 1rem;
        color: var(--header-colour);
        letter-spacing: -0.01em;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .strava-row-meta {
        font-size: 0.78rem;
        color: var(--paragraph-colour);
        opacity: 0.75;
        margin-top: 0.15rem;
    }
    .strava-row-stats {
        display: flex; gap: 0.85rem;
        font-size: 0.85rem;
        color: var(--paragraph-colour);
        flex-shrink: 0;
        text-align: right;
    }
    .strava-row-stats strong {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        color: var(--header-colour);
        display: block;
        line-height: 1.2;
    }
    .strava-row-stats span {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--main-green);
    }

    /* Year-to-date footer. Hidden by default; revealed only when the slot
       is wide enough to lay it out without crowding — i.e. large slots on
       desktop and full-width slots on mobile. In a narrow (1-col / "small")
       slot it stays hidden so the activity list keeps the room. The
       container is the .slot ancestor (container-name: slot). */
    .strava-ytd {
        display: none;
        flex-direction: column;
        gap: 0.35rem;
        margin-top: 0.6rem;
        padding-top: 0.6rem;
        border-top: 1px solid var(--main-green-translucent);
        flex-shrink: 0;
    }
    @container slot (min-width: 420px) {
        .strava-ytd { display: flex; }
    }
    .strava-ytd-label {
        font-size: 0.62rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--main-green);
        opacity: 0.8;
    }
    .strava-ytd-stats {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem 1.5rem;
        font-size: 0.85rem;
        color: var(--paragraph-colour);
    }
    .strava-ytd-item {
        display: inline-flex;
        align-items: baseline;
        gap: 0.35rem;
    }
    .strava-ytd-icon { font-size: 0.9rem; }
    .strava-ytd-item strong {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        color: var(--header-colour);
    }
    .strava-ytd-count {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--main-green);
    }
</style>
