<script>
    import { onMount } from 'svelte';

    export let type; // 'run' | 'ride'
    export let limit = 5;

    let activities = null; // null = loading
    let error = null;

    const ICONS = {
        Run: '🏃', TrailRun: '🏃', VirtualRun: '🏃',
        Ride: '🚴', VirtualRide: '🚴', EBikeRide: '🚴', MountainBikeRide: '🚵',
    };

    const pad = (n) => String(n).padStart(2, '0');

    // Decode a Google-encoded polyline string into [lat,lng] pairs and
    // project to an SVG path that fits the given box, centred and aspect-correct.
    function decodePolyline(str, precision = 5) {
        if (!str) return [];
        const factor = Math.pow(10, precision);
        const len = str.length;
        let index = 0, lat = 0, lng = 0;
        const points = [];
        while (index < len) {
            let b, shift = 0, result = 0;
            do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lat += (result & 1) ? ~(result >> 1) : (result >> 1);
            shift = 0; result = 0;
            do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lng += (result & 1) ? ~(result >> 1) : (result >> 1);
            points.push([lat / factor, lng / factor]);
        }
        return points;
    }

    function polylineToSvgPath(encoded, width = 64, height = 40, padding = 5) {
        const pts = decodePolyline(encoded);
        if (pts.length < 2) return null;
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const [lat, lng] of pts) {
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
        }
        const dLat = maxLat - minLat || 1;
        const dLng = maxLng - minLng || 1;
        const w = width - padding * 2;
        const h = height - padding * 2;
        const scale = Math.min(w / dLng, h / dLat);
        const offsetX = padding + (w - dLng * scale) / 2;
        const offsetY = padding + (h - dLat * scale) / 2;
        return pts.map(([lat, lng], i) => {
            const x = offsetX + (lng - minLng) * scale;
            const y = offsetY + (maxLat - lat) * scale;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(' ');
    }

    const formatDistance = (m) => {
        if (m == null) return '—';
        const km = m / 1000;
        return km >= 10 ? `${km.toFixed(1)} km` : `${km.toFixed(2)} km`;
    };

    const formatDuration = (s) => {
        if (s == null) return '—';
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const formatPace = (distanceM, timeS, t) => {
        if (!distanceM || !timeS) return null;
        const km = distanceM / 1000;
        const isRun = /Run|Walk|Hike/.test(t || '');
        if (isRun) {
            const sec = timeS / km;
            return `${Math.floor(sec / 60)}:${pad(Math.round(sec % 60))} /km`;
        }
        return `${(km / (timeS / 3600)).toFixed(1)} km/h`;
    };

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
            const res = await fetch(`/.netlify/functions/stravaFeed?limit=30`);
            if (!res.ok) throw new Error(`status ${res.status}`);
            const data = await res.json();
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
                {@const mapPath = polylineToSvgPath(a.polyline)}
                <li>
                    <a class="strava-row" href={a.id ? `https://www.strava.com/activities/${a.id}` : '#'} target="_blank" rel="noreferrer">
                        {#if mapPath}
                            <svg class="strava-row-map" viewBox="0 0 64 40" aria-hidden="true">
                                <path d={mapPath}/>
                            </svg>
                        {:else}
                            <span class="strava-row-icon" aria-hidden="true">{ICONS[a.type] || '🏃'}</span>
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
    .strava-list-wrap {
        margin: 1rem auto 0 auto;
        padding: 0 20px;
        max-width: 100%;
        text-align: left;
    }

    .strava-status {
        color: var(--modal-title-colour, #333);
        font-size: 0.9rem;
        text-align: center;
        opacity: 0.7;
        padding: 0.75rem 0;
    }

    .strava-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .strava-row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 0.85rem;
        padding: 0.6rem 0.75rem;
        border-radius: 10px;
        text-decoration: none;
        color: inherit;
        background: rgba(0, 0, 0, 0.03);
        border: 1px solid rgba(0, 0, 0, 0.08);
        transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    }

    .strava-row:hover {
        background: var(--main-green-translucent, rgba(0, 128, 111, 0.12));
        border-color: var(--main-green, #00806f);
    }
    .strava-row:active { transform: scale(0.99); }

    .strava-row-icon {
        font-size: 1.4rem;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
    }

    .strava-row-map {
        width: 64px;
        height: 40px;
        flex-shrink: 0;
        background: var(--main-green-translucent, rgba(0, 128, 111, 0.12));
        border-radius: 8px;
        padding: 4px;
        box-sizing: border-box;
        display: block;
    }
    .strava-row-map path {
        fill: none;
        stroke: var(--main-green, #00806f);
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .strava-row-main {
        display: flex;
        flex-direction: column;
        min-width: 0;
        line-height: 1.25;
    }

    .strava-row-name {
        font-weight: 600;
        color: var(--modal-title-colour, #222);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 0.95rem;
    }

    .strava-row-meta {
        font-size: 0.78rem;
        color: var(--modal-title-colour, #555);
        opacity: 0.65;
        margin-top: 0.1rem;
    }

    .strava-row-sep {
        display: inline-block;
        margin: 0 0.5em;
        opacity: 0.55;
    }

    .strava-row-stats {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.1rem;
        font-size: 0.85rem;
        color: var(--modal-title-colour, #333);
        white-space: nowrap;
    }

    .strava-row-stats strong {
        font-family: 'Fraunces', 'Iowan Old Style', 'Times New Roman', serif;
        font-weight: 600;
        font-size: 1rem;
        letter-spacing: -0.01em;
    }

    .strava-row-stats span {
        font-size: 0.75rem;
        color: var(--main-green, #00806f);
        opacity: 0.85;
    }

    @media (max-width: 460px) {
        .strava-list-wrap { padding: 0 10px; }
        .strava-row { gap: 0.6rem; padding: 0.5rem 0.6rem; }
        .strava-row-icon { font-size: 1.2rem; width: 1.6rem; }
        .strava-row-name { font-size: 0.88rem; }
    }
</style>
