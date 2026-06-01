<!--
    Recent Strava activities with route preview (when polyline available) or
    icon fallback. Hides itself if backing function returns 503. List is
    trimmed dynamically so no partial rows are shown.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import { timeAgo, trimListToFit } from "../lib/utils.js";
    import {
        STRAVA_ICONS,
        formatDistance,
        formatDuration,
        formatPace,
        polylineToSvgPath,
    } from "../lib/strava.js";

    let listEl = $state();
    let hidden = $state(false);
    let activities = $state(null); // null = loading
    let pollTimer;
    let resizeTimer;
    let resizeListener;

    async function load() {
        try {
            const res = await fetch("/.netlify/functions/stravaFeed?limit=5");
            if (res.status === 503) { hidden = true; return; }
            if (!res.ok) throw new Error("strava fetch failed");
            const data = await res.json();
            activities = data?.activities || [];
            requestAnimationFrame(() => trimListToFit(listEl));
        } catch {
            activities = [];
        }
    }

    onMount(() => {
        load();
        pollTimer = setInterval(load, 1000 * 60 * 5);
        resizeListener = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => trimListToFit(listEl), 100);
        };
        window.addEventListener("resize", resizeListener);
    });
    onDestroy(() => {
        clearInterval(pollTimer);
        clearTimeout(resizeTimer);
        window.removeEventListener("resize", resizeListener);
    });
</script>

{#if !hidden}
    <a class="profile-link" href="https://www.strava.com/athletes/92118908" target="_blank" rel="noreferrer">Strava ↗</a>
    <div class="widget-label">Physical Activity</div>
    <ol class="strava-list" bind:this={listEl}>
        {#if activities === null}
            <li class="widget-empty">Loading…</li>
        {:else if activities.length === 0}
            <li class="widget-empty">Strava unavailable</li>
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
</style>
