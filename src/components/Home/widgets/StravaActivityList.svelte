<script>
    import { onMount } from 'svelte';
    import { fetchJsonSwr } from '../../../lib/data/swrCache.js';
    import {
        STRAVA_ICONS,
        STRAVA_FEED_URL,
        formatDistance,
        formatDuration,
        formatPace,
        routeToSvgPath,
    } from '../../../lib/strava.js';

    export let type; // 'run' | 'ride'
    export let limit = 5;

    let activities = null; // null = loading
    let error = null;

    const formatDate = (iso) => {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return '';
        }
    };

    // The stravaFeed function returns a mixed feed of recent qualifying
    // activities; we filter to this widget's type client-side then slice
    // to the display limit.
    const TYPE_PATTERNS = {
        run:  /Run/i,
        ride: /Ride/i,
        walk: /Walk|Hike/i,
    };

    onMount(async () => {
        try {
            const data = await fetchJsonSwr(STRAVA_FEED_URL);
            const all = data?.activities || [];
            const re = TYPE_PATTERNS[type];
            const matched = re ? all.filter((a) => re.test(a.type || '')) : all;
            activities = matched.slice(0, limit);
        } catch (err) {
            error = err.message || 'Failed to load';
            activities = [];
        }
    });
</script>

<div class="strava-list-wrap">
    {#if activities === null}
        <div class="strava-status">Loading recent activity…</div>
    {:else if error}
        <div class="strava-status">Couldn't load Strava activity right now.</div>
    {:else if activities.length === 0}
        <div class="strava-status">No qualifying activities yet.</div>
    {:else}
        <ol class="strava-list">
            {#each activities as a (a.id)}
                {@const mapPath = routeToSvgPath(a.route, 64, 40)}
                <li>
                    <a class="strava-row" href={a.id ? `https://www.strava.com/activities/${a.id}` : '#'} target="_blank" rel="noreferrer">
                        {#if mapPath}
                            <svg class="strava-row-map" viewBox="0 0 64 40" aria-hidden="true">
                                <path d={mapPath}/>
                            </svg>
                        {:else}
                            <span class="strava-row-icon" aria-hidden="true">{STRAVA_ICONS[a.type] || '🏃'}</span>
                        {/if}
                        <span class="strava-row-main">
                            <span class="strava-row-name">{a.name || a.type || 'Activity'}</span>
                            <span class="strava-row-meta">
                                {formatDate(a.startDate)}{#if a.sufferScore != null}<span class="strava-row-sep" aria-hidden="true">·</span>Effort {Math.round(a.sufferScore)}{/if}
                            </span>
                        </span>
                        <span class="strava-row-stats">
                            <strong>{formatDistance(a.distance)}</strong>
                            <span>{formatPace(a.distance, a.movingTime, a.type) || formatDuration(a.movingTime)}</span>
                        </span>
                    </a>
                </li>
            {/each}
        </ol>
    {/if}
</div>

<style>
    /* Same row as the dashboard's activity widget: map thumb, name and
       meta, figures right-aligned, rows ruled apart. */
    .strava-list-wrap { margin-top: var(--space-4); text-align: left; }
    .strava-status { padding: var(--space-3) 0; font-size: var(--font-sm); color: var(--text-2); }
    .strava-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); }
    .strava-list li { border-bottom: 1px solid var(--border); }
    .strava-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2) 0;
        color: inherit;
    }
    .strava-row:hover .strava-row-name { color: var(--accent); }
    .strava-row-icon,
    .strava-row-map {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 36px;
        border-radius: var(--radius);
        background: var(--surface-2);
    }
    .strava-row-icon { font-size: 1.1rem; }
    .strava-row-map { padding: 4px; }
    .strava-row-map path {
        fill: none;
        stroke: var(--series-1);
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    .strava-row-main { display: flex; flex-direction: column; min-width: 0; }
    .strava-row-name {
        font-size: var(--font-sm);
        font-weight: var(--weight-medium);
        color: var(--text-strong);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color var(--dur-fast) var(--ease);
    }
    .strava-row-meta { font-size: var(--font-xs); color: var(--text-2); }
    .strava-row-sep { margin: 0 0.4em; color: var(--text-3); }
    .strava-row-stats {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .strava-row-stats strong { font-size: var(--font-sm); font-weight: var(--weight-semibold); color: var(--text-strong); }
    .strava-row-stats span { font-size: var(--font-2xs); color: var(--text-3); }
</style>
