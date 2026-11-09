<!--
    Dashboard scaffold. Owns:
      - the slot grid (3 rows × 4 cols, mobile collapse + container queries)
      - the layout state ($state array of widget IDs, persisted to localStorage)
      - drag-and-drop between slots, and the edit mode that gates it on mobile,
        both from lib/ui (reorder + editMode) and shared with /running

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
    import SiteNav from "../../lib/ui/SiteNav.svelte";
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
    let navHidden = $state(false);

    // Drag mechanics and the edit mode that gates them both live in lib/ui —
    // /running runs the same ones. Dragging is free on desktop and behind the
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

{#snippet actions()}
    {#if edit.isResponsive}
        <EditToggle editing={edit.isEditing} onclick={edit.toggle} />
    {/if}
{/snippet}

<SiteNav sticky={false} hideable bind:hidden={navHidden} {actions} />

<div
    class="dashboard drag-grid"
    class:nav-hidden={navHidden}
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
                    class="widget surface drag-tile widget-{widgetId}"
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
                    class="widget surface drag-tile widget-{widgetId}"
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
    /* Fills the viewport under the nav on a wide screen — a wall display,
       not a page — and becomes an ordinary scrolling page once it collapses. */
    .dashboard {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        grid-template-rows: 1.3fr 1fr 0.85fr;
        gap: var(--space-4);
        height: calc(100vh - var(--nav-height) - 1px);
        height: calc(100dvh - var(--nav-height) - 1px);
        max-width: 1800px;
        margin: 0 auto;
        padding: var(--space-4) var(--page-gutter);
        overflow: hidden;
    }
    /* The grab cursor, swallowed gestures and jiggle are in global.css under
       "Rearrangeable grids". The grid clips at full height, so it has to
       stop clipping while something is dragged out of it. */
    .dashboard.is-dragging { overflow: visible; }
    /* With the nav tucked away the grid takes the whole viewport, leaving a
       gutter at the top for the tab that brings the nav back. */
    .dashboard.nav-hidden {
        height: 100vh;
        height: 100dvh;
        padding-top: 26px;
    }

    /* Widget surface comes from the global .surface class (the same as a
       Card); a widget also has to be a flex column that clips its overflow. */
    :global(.widget) {
        position: relative;
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        padding: 20px;
        overflow: hidden;
    }
    :global(.widget-empty) {
        margin: auto 0;
        font-size: var(--font-sm);
        color: var(--text-2);
    }
    :global(.widget-loading) {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 0;
        margin: 0;
        list-style: none;
    }

    /* Widgets fill their slot edge to edge, so the drop outline sits inside. */
    .slot {
        display: flex;
        min-width: 0;
        min-height: 0;
        position: relative;
        --drop-outline-offset: -6px;
        container-type: size;
        container-name: slot;
    }
    .slot-large { grid-column: span 2; }
    .slot-small { grid-column: span 1; }
    .slot > :global(.widget) {
        flex: 1 1 auto;
        width: 100%;
        height: 100%;
    }
    .slot > :global(.widget.dragging) { z-index: 1000; }

    .slot > :global(.widget-gallery) {
        padding: 0;
        color: inherit;
        background: var(--surface-2);
    }

    /* spotify widget needs flex-row + relative for the viz canvas underlay */
    .slot > :global(.widget-spotify) {
        flex-direction: row;
        align-items: center;
        gap: var(--space-5);
    }

    /* weather widget is a left-right split */
    .slot > :global(.widget-weather) {
        flex-direction: row;
        gap: var(--space-6);
    }

    .slot > :global(.widget-clock) {
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: var(--space-2);
    }

    /* Compact overrides when widgets land in a 1-col slot. */
    .slot-small :global(.widget-clock) { padding: 20px 16px; gap: 6px; }
    .slot-small :global(.clock-time) { font-size: clamp(2.25rem, 7vw, 4rem); }
    .slot-small :global(.clock-meridiem) { font-size: clamp(0.7rem, 1.1vw, 1rem); }
    .slot-small :global(.clock-greeting) { font-size: clamp(0.95rem, 1.4vw, 1.2rem); }
    .slot-small :global(.clock-date) { font-size: var(--font-xs); }
    .slot-small :global(.clock-meta) { gap: var(--space-2); flex-direction: column; }
    .slot-small :global(.clock-progress) {
        grid-template-columns: 1fr;
        gap: var(--space-2);
        margin-top: var(--space-3);
        max-width: 100%;
    }

    .slot-small :global(.weather-stats > div:nth-child(n+3)) { display: none; }

    /* Spotify's art + info row doesn't fit a 1-col slot: stack it. */
    .slot-small :global(.widget-spotify),
    .slot-small :global(.widget-spotify .spotify-main) {
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: var(--space-3);
    }
    .slot-small :global(.widget-spotify .spotify-art) {
        width: clamp(56px, 22vw, 96px);
        height: clamp(56px, 22vw, 96px);
    }
    .slot-small :global(.widget-spotify .spotify-info) { align-items: center; width: 100%; min-width: 0; }
    .slot-small :global(.widget-spotify .spotify-progress) { width: 100%; }

    @container slot (max-height: 320px) {
        :global(.widget-clock) { padding: 16px 20px; gap: 4px; }
        :global(.widget-clock .clock-greeting) { font-size: clamp(0.95rem, 1.4vw, 1.2rem); }
        :global(.widget-clock .clock-date) { font-size: var(--font-xs); }
        :global(.widget-clock .clock-progress) { margin-top: var(--space-2); gap: var(--space-3); max-width: 480px; }
    }

    @container slot (max-height: 300px) {
        :global(.widget-weather) { flex-direction: column; gap: var(--space-3); padding: 20px; }
        :global(.widget-weather .weather-left) { flex: 1 1 auto; gap: 6px; }
        :global(.widget-weather .weather-right) { display: none; }
        :global(.widget-weather .weather-temp) { font-size: clamp(2rem, 4.5vw, 3rem); }
        :global(.widget-weather .weather-stats) { gap: 4px var(--space-3); }
    }

    /* === edit mode (once collapsed) ===
       Alternate slots take the second jiggle so the grid doesn't rock in
       lockstep. */
    .dashboard.is-editing .slot:nth-child(odd) > :global(.widget:not(.dragging)) {
        animation-name: edit-jiggle-b;
        animation-duration: 0.46s;
        animation-delay: -0.18s;
    }

    @media (max-width: 1100px) {
        .dashboard {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-template-rows: auto;
            height: auto;
            overflow: visible;
            padding-bottom: var(--space-7);
        }
        .dashboard.nav-hidden { height: auto; }
        .slot { container-type: inline-size; }
        .slot-large, .slot-small { grid-column: span 2; }
        .slot > :global(.widget-gallery) { aspect-ratio: 16 / 9; }
        /* A finger scrolls the page until edit mode says otherwise. */
        .slot > :global(.widget) { touch-action: auto; cursor: default; }
        .dashboard.is-editing .slot > :global(.widget) { touch-action: none; }
    }

    @media (max-width: 700px) {
        .dashboard { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); }
        .slot-large, .slot-small { grid-column: span 1; }
        .slot > :global(.widget-weather) { flex-direction: column; }
    }
</style>
