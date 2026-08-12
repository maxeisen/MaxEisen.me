<!--
    Dashboard scaffold. Owns:
      - the slot grid (3 rows × 4 cols, mobile collapse + container queries)
      - the layout state ($state array of widget IDs, persisted to localStorage)
      - drag-and-drop between slots, and the edit mode that gates it on mobile,
        both from lib/ui (reorder + editMode) and shared with /training

    Widget components are content-only — Dashboard provides the .widget wrapper
    div (or <a> for the gallery widget which is a link). Each widget id maps
    to a component + slot size + wrapper kind. Default order is preserved
    when no layout is in storage or storage is corrupt.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import ClockWidget from "./widgets/ClockWidget.svelte";
    import GalleryWidget from "./widgets/GalleryWidget.svelte";
    import WeatherWidget from "./widgets/WeatherWidget.svelte";
    import SpotifyWidget from "./widgets/SpotifyWidget.svelte";
    import StravaWidget from "./widgets/StravaWidget.svelte";
    import GithubWidget from "./widgets/GithubWidget.svelte";
    import HackerNewsWidget from "./widgets/HackerNewsWidget.svelte";
    import SpotifyVizOverlay from "./SpotifyVizOverlay.svelte";
    import BackLink from "../../lib/ui/BackLink.svelte";
    import EditToggle from "../../lib/ui/EditToggle.svelte";
    import { createRearrangeable } from "../../lib/ui/editMode.svelte.js";

    const WIDGETS = {
        clock:   { component: ClockWidget,      kind: "div" },
        gallery: { component: GalleryWidget,    kind: "a", href: "/gallery" },
        weather: { component: WeatherWidget,    kind: "div" },
        spotify: { component: SpotifyWidget,    kind: "div" },
        strava:  { component: StravaWidget,     kind: "div" },
        github:  { component: GithubWidget,     kind: "div" },
        hn:      { component: HackerNewsWidget, kind: "div" },
    };

    // Slot sizes are fixed by position, not by which widget currently sits
    // there. Five 2-col + two 1-col slots arrange neatly as (2+2)/(2+2)/
    // (2+1+1) into a 4-col grid. Any widget can occupy any slot; widgets
    // adapt via container queries + slot-small overrides below.
    const SLOT_SIZES = ["large", "large", "large", "large", "large", "small", "small"];

    const DEFAULT_ORDER = ["clock", "gallery", "weather", "spotify", "strava", "github", "hn"];
    const LAYOUT_KEY = "dashboard-layout";

    let dashboardEl;

    // Drag mechanics and the edit mode that gates them both live in lib/ui —
    // /training runs the same ones. Dragging is free on desktop and behind the
    // toggle once the layout goes responsive, where a press-and-drag is
    // otherwise a scroll.
    const { reorder, edit } = createRearrangeable({
        gridId: "dashboard-grid",
        responsiveQuery: "(max-width: 1100px)",
        order: DEFAULT_ORDER,
        storageKey: LAYOUT_KEY,
        // Swap-flash + forced resize so list trimming and the viz canvas re-fit.
        onReorder: () => requestAnimationFrame(() => window.dispatchEvent(new Event("resize"))),
    });
    const layout = $derived(reorder.layout);

    onMount(() => {
        reorder.restore();
        edit.listen();
    });

    onDestroy(() => edit.stop());
</script>

<svelte:head>
    <title>Dashboard | MaxEisen.me</title>
    <meta name="robots" content="noindex"/>
    <link rel="canonical" href="https://maxeisen.me/dashboard"/>
</svelte:head>

<BackLink />

{#if edit.isResponsive}
    <EditToggle editing={edit.isEditing} onclick={edit.toggle} />
{/if}

<div
    class="dashboard drag-grid"
    class:is-editing={edit.isEditing}
    class:is-dragging={reorder.isDragging}
    bind:this={dashboardEl}
    id="dashboard-grid"
>
    {#each layout as widgetId, idx (widgetId)}
        {@const cfg = WIDGETS[widgetId]}
        <div
            class="slot slot-{SLOT_SIZES[idx]}"
            class:drop-target={reorder.dropTargetIdx === idx}
            data-slot-index={idx}
        >
            {#if cfg.kind === "a"}
                <a
                    class="widget drag-tile widget-{widgetId}"
                    class:dragging={reorder.draggingId === widgetId}
                    data-widget={widgetId}
                    href={cfg.href}
                    style:transform={reorder.transformFor(widgetId)}
                    onpointerdown={(e) => reorder.start(widgetId, e)}
                >
                    <cfg.component />
                </a>
            {:else}
                <div
                    class="widget drag-tile widget-{widgetId}"
                    class:dragging={reorder.draggingId === widgetId}
                    data-widget={widgetId}
                    style:transform={reorder.transformFor(widgetId)}
                    onpointerdown={(e) => reorder.start(widgetId, e)}
                >
                    <cfg.component />
                </div>
            {/if}
        </div>
    {/each}
</div>

<SpotifyVizOverlay />

<style>
    /* body styles scoped to the dashboard's mount lifecycle — Svelte removes
       these :global rules when the component unmounts, so they don't bleed
       to the homepage. margin/padding reset prevents the default 8px body
       margin from pushing the 100vh dashboard past the viewport. */
    :global(body) {
        margin: 0;
        padding: 0;
        background-image:
            radial-gradient(circle at 50% 50%, var(--background-glow) 0%, transparent 45%),
            radial-gradient(circle at 50% 50%, var(--background-accent) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, var(--background-two) 0%, transparent 55%),
            radial-gradient(circle at 50% 50%, var(--background-two) 0%, transparent 60%);
        background-size: 180% 180%, 200% 200%, 220% 220%, 270% 270%;
        background-repeat: no-repeat;
        background-attachment: fixed;
        animation: gradient 25s ease-in-out infinite; /* keyframe in global.css */
    }
    @media (prefers-reduced-motion: reduce) {
        :global(body) { animation: none; }
    }

    .dashboard {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        grid-template-rows: 1.3fr 1fr 0.85fr;
        gap: 1rem;
        padding: 1rem;
        height: 100vh;
        max-height: 100vh;
        overflow: hidden;
        max-width: 1800px;
        margin: 0 auto;
    }
    /* The grab cursor, the swallowed gestures and the jiggle are in global.css
       under "Rearrangeable grids", shared with /training. What's left here is
       what this page does differently — starting with a grid that clips at
       100vh and has to stop while something is being dragged out of it. */
    .dashboard.is-dragging { overflow: visible; }

    :global(.widget) {
        position: relative;
        background: var(--inner-background, rgba(0, 0, 0, 0.25));
        border: 1px solid var(--main-green-translucent);
        border-radius: 20px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        min-height: 0;
        min-width: 0;
        overflow: hidden;
    }
    :global(.widget-label) {
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--main-green);
        margin-bottom: 0.5rem;
    }
    :global(.widget-empty) {
        color: var(--paragraph-colour);
        opacity: 0.55;
        font-size: 0.9rem;
        margin: auto 0;
    }
    :global(.profile-link) {
        position: absolute;
        top: 0.6rem;
        right: 0.85rem;
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        color: var(--main-green);
        text-decoration: none;
        opacity: 0.5;
        transition: opacity 0.2s ease;
        z-index: 2;
    }
    :global(.profile-link:hover) { opacity: 1; }

    /* Widgets fill their slot edge to edge, so the drop outline is drawn
       inside them; the treatment itself is in global.css. */
    .slot {
        display: flex;
        min-width: 0;
        min-height: 0;
        position: relative;
        --drop-outline-offset: -8px;
        --drop-outline-radius: 20px;
        container-type: size;
        container-name: slot;
    }
    .slot-large { grid-column: span 2; }
    .slot-small { grid-column: span 1; }
    .slot > :global(.widget) {
        flex: 1 1 auto;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
    }
    .slot > :global(.widget.dragging) {
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
        z-index: 1000;
        transition: box-shadow 0.15s ease;
    }

    .slot > :global(.widget-gallery) {
        padding: 0;
        overflow: hidden;
        text-decoration: none;
        color: inherit;
        background: var(--main-green-translucent);
    }
    .slot > :global(.widget-gallery *) { text-decoration: none; }

    /* spotify widget needs flex-row + relative for the viz canvas underlay */
    .slot > :global(.widget-spotify) {
        flex-direction: row;
        align-items: center;
        gap: 1.25rem;
    }

    /* weather widget is a left-right split */
    .slot > :global(.widget-weather) {
        flex-direction: row;
        gap: 1.25rem;
    }

    /* clock is centered */
    .slot > :global(.widget-clock) {
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 0.5rem;
    }

    /* Compact overrides when widgets land in a 1-col slot. */
    .slot-small :global(.widget-clock) { padding: 1.25rem 1rem; gap: 0.35rem; }
    .slot-small :global(.clock-time) { font-size: clamp(2.25rem, 7vw, 4rem); }
    .slot-small :global(.clock-meridiem) { font-size: clamp(0.7rem, 1.1vw, 1rem); }
    .slot-small :global(.clock-greeting) { font-size: clamp(0.95rem, 1.4vw, 1.2rem); }
    .slot-small :global(.clock-date) { font-size: 0.8rem; }
    .slot-small :global(.clock-meta) { gap: 0.5rem; flex-direction: column; }
    .slot-small :global(.clock-progress) {
        grid-template-columns: 1fr;
        gap: 0.5rem;
        margin-top: 0.75rem;
        max-width: 100%;
    }
    .slot-small :global(.clock-progress-pct) { font-size: 0.85rem; }
    .slot-small :global(.clock-progress-label) { font-size: 0.65rem; }

    .slot-small :global(.weather-stats > div:nth-child(n+3)) { display: none; }

    /* Spotify is the only large-by-default widget whose layout (flex-row
       art + info) doesn't naturally fit a 1-col slot. Stack vertically
       and shrink the art so it reads cleanly in either size. */
    .slot-small :global(.widget-spotify),
    .slot-small :global(.widget-spotify .spotify-main) {
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.75rem;
    }
    .slot-small :global(.widget-spotify .spotify-art) {
        width: clamp(56px, 22vw, 96px);
        height: clamp(56px, 22vw, 96px);
    }
    .slot-small :global(.widget-spotify .spotify-info) {
        align-items: center;
        width: 100%;
        min-width: 0;
    }
    .slot-small :global(.widget-spotify .spotify-progress) {
        width: 100%;
    }

    @container slot (max-height: 320px) {
        :global(.widget-clock) { padding: 1rem 1.25rem; gap: 0.25rem; }
        :global(.widget-clock .clock-greeting) { font-size: clamp(0.95rem, 1.4vw, 1.2rem); }
        :global(.widget-clock .clock-date) { font-size: 0.8rem; }
        :global(.widget-clock .clock-daylight) { font-size: 0.7rem; margin-top: 0.2rem; }
        :global(.widget-clock .clock-progress) { margin-top: 0.5rem; gap: 0.6rem; max-width: 480px; }
        :global(.widget-clock .clock-progress-pct) { font-size: 0.85rem; }
        :global(.widget-clock .clock-progress-label) { font-size: 0.65rem; }
    }

    @container slot (max-height: 300px) {
        :global(.widget-weather) { flex-direction: column; gap: 0.75rem; padding: 1.25rem; }
        :global(.widget-weather .weather-left) { flex: 1 1 auto; gap: 0.4rem; }
        :global(.widget-weather .weather-right) { display: none; }
        :global(.widget-weather .weather-temp) { font-size: clamp(2rem, 4.5vw, 3rem); }
        :global(.widget-weather .weather-stats) { grid-template-columns: 1fr 1fr; gap: 0.3rem 0.75rem; font-size: 0.78rem; }
    }

    /* === edit mode (mobile only) ===
       The toggle is lib/ui/EditToggle and the jiggle is in global.css, both
       shared with /training. Alternate slots take the second of the two, so
       the grid doesn't rock in lockstep — this page alternates by slot,
       /training by column. */
    .dashboard.is-editing .slot:nth-child(odd) > :global(.widget:not(.dragging)) {
        animation-name: edit-jiggle-b;
        animation-duration: 0.46s;
        animation-delay: -0.18s;
    }

    @media (max-width: 1100px) {
        .dashboard {
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: auto;
            height: auto;
            max-height: none;
            overflow: visible;
        }
        .slot { container-type: inline-size; }
        .slot-large, .slot-small { grid-column: span 2; }
        .slot > :global(.widget-gallery) { aspect-ratio: 16 / 9; }
        /* A finger scrolls the page until edit mode says otherwise. */
        .slot > :global(.widget) { touch-action: auto; cursor: default; }
        .dashboard.is-editing .slot > :global(.widget) { touch-action: none; }
    }

    @media (max-width: 700px) {
        .dashboard {
            grid-template-columns: 1fr;
            gap: 1rem;
            padding: 1rem;
        }
        .slot-large, .slot-small { grid-column: span 1; }
        .slot > :global(.widget-weather) { flex-direction: column; }
    }
</style>
