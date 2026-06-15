<!--
    Curated Toronto map. Loads MapLibre dynamically so the lib only ships
    on /toronto, fetches the pin set from public/content/toronto.json, and
    coordinates the slide-in panel state.

    Only pins flagged `published: true` are rendered, so the curation
    workflow is: import (or hand-add) → write notes / set category → flip
    `published: true` → it shows on the map.
-->
<script>
    import { onMount } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import MapView from "./MapView.svelte";
    import PinPanel from "./PinPanel.svelte";
    import FilterBar from "./FilterBar.svelte";
    import BackLink from "../../lib/ui/BackLink.svelte";

    let maplibre = $state(null);
    let allPins = $state([]);
    let routes = $state([]);
    let selected = $state(null);
    let loadError = $state("");

    // Category filter — chips in the bottom bar toggle entries in this
    // set. Multi-select; an empty set hides every pin.
    const activeCategories = new SvelteSet();
    let routesEnabled = $state(true);

    // Render only pins flagged published, then apply the category filter.
    const publishedPins = $derived(allPins.filter((p) => p.published));
    const categories = $derived([...new Set(publishedPins.map((p) => p.category).filter(Boolean))].sort());
    const visiblePins = $derived(publishedPins.filter((p) => activeCategories.has(p.category)));
    const visibleRoutes = $derived(routesEnabled ? routes : []);

    // Strava activities that pass through the GTA bbox. stravaFeed
    // returns recent activities with encoded polylines; we just keep the
    // ones with a polyline that has at least one point within the box.
    async function loadRoutes() {
        try {
            const res = await fetch("/.netlify/functions/stravaFeed?limit=30");
            if (!res.ok) return;
            const data = await res.json();
            const acts = data?.activities || [];
            routes = acts
                .filter((a) => a.polyline && polylineTouchesGTA(a.polyline))
                .map((a) => ({ id: a.id, name: a.name, polyline: a.polyline }));
        } catch {
            // Strava is optional decoration — failure shouldn't block the map.
        }
    }

    // Quick reject: scan the encoded polyline's first decoded point. Cheap,
    // and good enough since a single activity is usually entirely in one
    // metro. The MapView's encoded-polyline decoder is more thorough but
    // we don't need its full output here.
    function polylineTouchesGTA(encoded) {
        const factor = 1e5;
        let lat = 0, lng = 0, index = 0, b, shift, result;
        try {
            shift = 0; result = 0;
            do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lat += (result & 1) ? ~(result >> 1) : (result >> 1);
            shift = 0; result = 0;
            do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lng += (result & 1) ? ~(result >> 1) : (result >> 1);
            const dLat = lat / factor, dLng = lng / factor;
            return dLat >= 43.4 && dLat <= 43.95 && dLng >= -79.7 && dLng <= -79.0;
        } catch { return false; }
    }

    onMount(async () => {
        document.body.classList.add("toronto-page");

        const [libMod, pinsRes] = await Promise.all([
            import("maplibre-gl").then((m) => m.default),
            fetch("/content/toronto.json"),
            loadRoutes(),
        ]);

        try {
            const data = await pinsRes.json();
            allPins = Array.isArray(data) ? data : [];
            // Default: every category active. Compute this after pins land
            // so the chip set matches the actual data.
            for (const cat of new Set(allPins.filter((p) => p.published && p.category).map((p) => p.category))) {
                activeCategories.add(cat);
            }
        } catch (err) {
            loadError = "Couldn't load the map data.";
            console.error("toronto.json load failed:", err);
        }

        await import("maplibre-gl/dist/maplibre-gl.css");
        maplibre = libMod;

        return () => document.body.classList.remove("toronto-page");
    });
</script>

<svelte:head>
    <title>Around Toronto | MaxEisen.me</title>
    <link rel="canonical" href="https://maxeisen.me/toronto"/>
</svelte:head>

<BackLink />

<header class="toronto-header">
    <h1>Around Toronto</h1>
    <p class="toronto-subtitle">A growing collection of my favourite places in the city — and a few notes on each.</p>
</header>

<main class="toronto-stage">
    {#if loadError}
        <div class="toronto-error">{loadError}</div>
    {:else if !maplibre}
        <div class="toronto-loading">Loading map…</div>
    {:else}
        <MapView
            {maplibre}
            pins={visiblePins}
            routes={visibleRoutes}
            onselect={(p) => (selected = p)}
        />
        <PinPanel pin={selected} onclose={() => (selected = null)} />
        {#if categories.length > 0 || routes.length > 0}
            <FilterBar
                {categories}
                {activeCategories}
                bind:routesEnabled
                routesAvailable={routes.length > 0}
            />
        {/if}
        {#if publishedPins.length === 0 && routes.length === 0}
            <div class="toronto-empty"><p>Curation in progress — pins coming soon.</p></div>
        {/if}
    {/if}
</main>

<style>
    /* Full-bleed map layout: header pinned, map fills the rest. Body
       overflow locked so the map's pan/zoom isn't fighting page scroll. */
    :global(body.toronto-page) {
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: var(--background-one);
        color: var(--paragraph-colour);
        font-family: 'Inter', sans-serif;
        font-weight: 300;
        line-height: 1.4;
    }

    .toronto-header {
        position: fixed;
        top: 1rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 5;
        padding: 0.6rem 1rem;
        background: var(--inner-background, rgba(0, 0, 0, 0.45));
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid var(--main-green-translucent);
        border-radius: 999px;
        display: flex;
        align-items: baseline;
        gap: 0.85rem;
        max-width: calc(100vw - 7rem);
    }
    .toronto-header h1 {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        letter-spacing: -0.02em;
        font-size: 1.1rem;
        color: var(--header-colour);
        margin: 0;
        white-space: nowrap;
    }
    .toronto-subtitle {
        margin: 0;
        font-size: 0.78rem;
        color: var(--paragraph-colour);
        opacity: 0.7;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    @media (max-width: 700px) {
        .toronto-subtitle { display: none; }
        .toronto-header { padding: 0.5rem 0.85rem; }
    }

    .toronto-stage {
        position: fixed;
        inset: 0;
    }

    .toronto-loading,
    .toronto-error,
    .toronto-empty {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: var(--paragraph-colour);
        opacity: 0.7;
        font-size: 0.9rem;
        text-align: center;
        padding: 0.85rem 1.25rem;
        background: var(--inner-background, rgba(0, 0, 0, 0.5));
        border: 1px solid var(--main-green-translucent);
        border-radius: 14px;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 4;
        pointer-events: none;
    }
    .toronto-empty p { margin: 0; }
    .toronto-error { color: var(--color-error); }

</style>
