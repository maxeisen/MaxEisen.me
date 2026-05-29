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
    import MapView from "./MapView.svelte";
    import PinPanel from "./PinPanel.svelte";

    let maplibre = $state(null);
    let allPins = $state([]);
    let selected = $state(null);
    let loadError = $state("");

    // Render only pins explicitly flagged published. Defaults to safe —
    // an unpublished or partially-curated pin in toronto.json won't leak.
    const visiblePins = $derived(allPins.filter((p) => p.published));

    function onHomeClick(e) {
        try {
            const fromSameOrigin = document.referrer && new URL(document.referrer).origin === window.location.origin;
            if (fromSameOrigin && window.history.length > 1) {
                e.preventDefault();
                window.history.back();
            }
        } catch {}
    }

    onMount(async () => {
        document.body.classList.add("toronto-page");

        // Pull the data + the lib in parallel — neither blocks the other.
        const [libMod, pinsRes] = await Promise.all([
            import("maplibre-gl").then((m) => m.default),
            fetch("/content/toronto.json"),
        ]);

        try {
            const data = await pinsRes.json();
            allPins = Array.isArray(data) ? data : [];
        } catch (err) {
            loadError = "Couldn't load the map data.";
            console.error("toronto.json load failed:", err);
        }

        // MapLibre needs its CSS too; bundle it via dynamic import so it
        // only loads on this route.
        await import("maplibre-gl/dist/maplibre-gl.css");
        maplibre = libMod;

        return () => document.body.classList.remove("toronto-page");
    });
</script>

<svelte:head>
    <title>Around Toronto | MaxEisen.me</title>
    <link rel="canonical" href="https://maxeisen.me/toronto"/>
</svelte:head>

<a class="home-link" href="/" onclick={onHomeClick} aria-label="Back to homepage">
    <span class="home-link-text">← back</span>
    <svg class="home-link-arrow" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M12.5 8 H3.5 M6.5 5 L3.5 8 L6.5 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
</a>

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
        <MapView {maplibre} pins={visiblePins} onselect={(p) => (selected = p)} />
        <PinPanel pin={selected} onclose={() => (selected = null)} />
        {#if visiblePins.length === 0}
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
    .toronto-error { color: #d97777; }

    /* Reuse the same back-button styling as Gallery so chrome reads
       consistently across SPA routes. */
    .home-link {
        position: fixed;
        top: 1rem;
        left: 1.25rem;
        z-index: 10;
        display: inline-flex;
        align-items: center;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--main-green);
        text-decoration: none;
        opacity: 0.45;
        transition: opacity 0.2s ease;
    }
    .home-link:hover { opacity: 1; }
    .home-link-arrow {
        display: none;
        width: 0.95rem;
        height: 0.95rem;
        flex-shrink: 0;
    }
    @media (max-width: 1100px) {
        .home-link {
            top: 0.5rem;
            left: 0.75rem;
            width: 2rem;
            height: 2rem;
            box-sizing: border-box;
            justify-content: center;
            align-items: center;
            line-height: 1;
            padding: 0;
            background: var(--inner-background, rgba(0, 0, 0, 0.25));
            border: 1px solid var(--main-green-translucent);
            border-radius: 50%;
            opacity: 0.7;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }
        .home-link-text { display: none; }
        .home-link-arrow { display: block; }
    }
</style>
