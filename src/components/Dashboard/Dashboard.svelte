<!--
    Dashboard scaffold. Owns:
      - the slot grid (3 rows × 4 cols, mobile collapse + container queries)
      - the layout state ($state array of widget IDs, persisted to localStorage)
      - drag-and-drop between slots (whole-widget drag, 5px threshold, no
        setPointerCapture so anchor clicks aren't redirected)
      - edit mode toggle (mobile only; required before drag is enabled)

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
    const DRAG_THRESHOLD = 5;

    function loadLayout() {
        try {
            const raw = localStorage.getItem(LAYOUT_KEY);
            if (!raw) return null;
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr) || arr.length !== DEFAULT_ORDER.length) return null;
            if (new Set(arr).size !== arr.length) return null;
            if (!arr.every((id) => DEFAULT_ORDER.includes(id))) return null;
            return arr;
        } catch { return null; }
    }

    let layout = $state([...DEFAULT_ORDER]);
    let isEditing = $state(false);
    let isResponsive = $state(false);
    let isDragging = $state(false);
    let draggingId = $state(null);
    let dropTargetIdx = $state(null);
    let dragTransform = $state(null); // { x, y } | null

    let dashboardEl;
    let widgetEls = {}; // id -> element (for transform during drag)
    let suppressClickUntil = 0;
    let responsiveQuery;
    let onResponsiveChange;
    let clickCapture;

    function swap(srcIdx, dstIdx) {
        if (srcIdx === dstIdx) return;
        const next = [...layout];
        [next[srcIdx], next[dstIdx]] = [next[dstIdx], next[srcIdx]];
        layout = next;
        try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch {}
        // Brief swap-flash + force-resize so list trimming + viz canvas re-fit.
        requestAnimationFrame(() => {
            window.dispatchEvent(new Event("resize"));
        });
    }

    // Whole-widget drag. Listeners are attached on pointerdown and torn down
    // on pointerup. We intentionally do NOT setPointerCapture — capturing
    // redirects the synthesized click to the widget instead of the actual
    // anchor inside, breaking link navigation.
    //
    // We deliberately do NOT set draggingId until the user crosses the 5px
    // threshold. `class:dragging` adds pointer-events:none on the widget; if
    // it flips on at pointerdown, the synthetic click after a non-drag press
    // dispatches to the slot underneath instead of the anchor inside, and
    // nothing in the widget becomes clickable. Defer it to onMove.
    function initDrag(widgetId, e) {
        if (e.button !== undefined && e.button !== 0) return;
        if (draggingId !== null) return;
        if (isResponsive && !isEditing) return;

        const pointerId = e.pointerId;
        const startX = e.clientX;
        const startY = e.clientY;
        let started = false;

        const onMove = (ev) => {
            if (ev.pointerId !== pointerId) return;
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if (!started) {
                if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
                started = true;
                draggingId = widgetId;
                isDragging = true;
            }
            ev.preventDefault();
            dragTransform = { x: dx, y: dy };
            // .dragging has pointer-events: none in CSS so elementFromPoint
            // pierces through to the slot under the cursor.
            const el = document.elementFromPoint(ev.clientX, ev.clientY);
            const slot = el?.closest(".slot[data-slot-index]");
            const idx = slot ? Number(slot.dataset.slotIndex) : null;
            const srcIdx = layout.indexOf(widgetId);
            dropTargetIdx = (idx != null && idx !== srcIdx) ? idx : null;
        };

        const onEnd = (ev) => {
            if (ev.pointerId !== pointerId) return;
            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onEnd);
            document.removeEventListener("pointercancel", onEnd);
            if (started) {
                const srcIdx = layout.indexOf(widgetId);
                const dstIdx = dropTargetIdx;
                if (dstIdx != null && dstIdx !== srcIdx) swap(srcIdx, dstIdx);
                suppressClickUntil = Date.now() + 300;
            }
            isDragging = false;
            draggingId = null;
            dropTargetIdx = null;
            dragTransform = null;
        };

        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onEnd);
        document.addEventListener("pointercancel", onEnd);
    }

    function toggleEditing(e) {
        e.stopPropagation();
        isEditing = !isEditing;
    }

    onMount(() => {
        const stored = loadLayout();
        if (stored) layout = stored;

        responsiveQuery = window.matchMedia("(max-width: 1100px)");
        isResponsive = responsiveQuery.matches;
        onResponsiveChange = (e) => {
            isResponsive = e.matches;
            if (!e.matches) isEditing = false;
        };
        responsiveQuery.addEventListener("change", onResponsiveChange);

        // Capture-phase click suppression. Beats anchor navigation. Suppresses
        // inside the dashboard within 300ms of drag, and at all times while
        // editing (matches iOS jiggle-mode where taps don't open icons).
        clickCapture = (e) => {
            if (!e.target.closest("#dashboard-grid")) return;
            if (Date.now() < suppressClickUntil || isEditing) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        document.addEventListener("click", clickCapture, true);
    });

    onDestroy(() => {
        responsiveQuery?.removeEventListener("change", onResponsiveChange);
        document.removeEventListener("click", clickCapture, true);
    });
</script>

<svelte:head>
    <title>Dashboard | MaxEisen.me</title>
    <meta name="robots" content="noindex"/>
    <link rel="canonical" href="https://maxeisen.me/dashboard"/>
</svelte:head>

<BackLink />

<button
    class="dashboard-edit-btn"
    class:active={isEditing}
    type="button"
    aria-pressed={isEditing ? "true" : "false"}
    aria-label="Toggle layout edit mode"
    onclick={toggleEditing}
>
    <span class="dashboard-edit-icon" aria-hidden="true">✎</span>
    <span class="dashboard-edit-label">{isEditing ? "Done" : "Edit"}</span>
</button>

<div
    class="dashboard"
    class:is-editing={isEditing}
    class:is-dragging={isDragging}
    bind:this={dashboardEl}
    id="dashboard-grid"
>
    {#each layout as widgetId, idx (widgetId)}
        {@const cfg = WIDGETS[widgetId]}
        <div
            class="slot slot-{SLOT_SIZES[idx]}"
            class:drop-target={dropTargetIdx === idx}
            data-slot-index={idx}
        >
            {#if cfg.kind === "a"}
                <a
                    class="widget widget-{widgetId}"
                    class:dragging={draggingId === widgetId}
                    data-widget={widgetId}
                    href={cfg.href}
                    style:transform={draggingId === widgetId && dragTransform ? `translate(${dragTransform.x}px, ${dragTransform.y}px) scale(1.02)` : null}
                    onpointerdown={(e) => initDrag(widgetId, e)}
                >
                    <cfg.component />
                </a>
            {:else}
                <div
                    class="widget widget-{widgetId}"
                    class:dragging={draggingId === widgetId}
                    data-widget={widgetId}
                    style:transform={draggingId === widgetId && dragTransform ? `translate(${dragTransform.x}px, ${dragTransform.y}px) scale(1.02)` : null}
                    onpointerdown={(e) => initDrag(widgetId, e)}
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
    .dashboard.is-dragging { overflow: visible; }
    .dashboard.is-dragging,
    .dashboard.is-dragging :global(*) { cursor: grabbing !important; }

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

    .slot {
        display: flex;
        min-width: 0;
        min-height: 0;
        position: relative;
        border-radius: 20px;
        transition: outline 0.15s ease;
        outline: 2px dashed transparent;
        outline-offset: -8px;
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
        cursor: grab;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
    }
    .slot > :global(.widget.dragging) {
        cursor: grabbing;
        opacity: 0.92;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
        z-index: 1000;
        transition: box-shadow 0.15s ease;
        pointer-events: none;
    }
    .slot.drop-target { outline-color: var(--main-green); }

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

    /* === edit mode (mobile only) === */
    .dashboard-edit-btn {
        display: none;
        position: fixed;
        top: 0.5rem;
        right: 0.75rem;
        z-index: 50;
        align-items: center;
        gap: 0.4rem;
        padding: 0.45rem 0.85rem;
        background: var(--inner-background, rgba(0, 0, 0, 0.35));
        border: 1px solid var(--main-green-translucent);
        border-radius: 999px;
        color: var(--main-green);
        font-family: inherit;
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        cursor: pointer;
        opacity: 0.85;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: background 0.2s ease, color 0.2s ease, opacity 0.2s ease;
    }
    .dashboard-edit-btn:hover { opacity: 1; }
    .dashboard-edit-btn:active { transform: scale(0.96); }
    .dashboard-edit-btn.active {
        background: var(--main-green);
        color: var(--background-one);
        border-color: var(--main-green);
        opacity: 1;
    }
    .dashboard-edit-icon { font-size: 0.95rem; line-height: 1; }

    /* iOS-style jiggle while in edit mode. Two animations + odd/even
       offsets so widgets don't move in lockstep. */
    @keyframes widget-jiggle-a {
        0%   { transform: rotate(-0.5deg) translate(0, 0); }
        50%  { transform: rotate(0.5deg)  translate(0, -1px); }
        100% { transform: rotate(-0.5deg) translate(0, 0); }
    }
    @keyframes widget-jiggle-b {
        0%   { transform: rotate(0.55deg)  translate(0, -1px); }
        50%  { transform: rotate(-0.55deg) translate(0, 0); }
        100% { transform: rotate(0.55deg)  translate(0, -1px); }
    }
    .dashboard.is-editing .slot > :global(.widget) {
        animation: widget-jiggle-a 0.42s ease-in-out infinite;
        transform-origin: center;
        will-change: transform;
    }
    .dashboard.is-editing .slot:nth-child(odd) > :global(.widget) {
        animation-name: widget-jiggle-b;
        animation-duration: 0.46s;
        animation-delay: -0.18s;
    }
    .dashboard.is-editing .slot > :global(.widget.dragging) { animation: none; }

    @media (prefers-reduced-motion: reduce) {
        .dashboard.is-editing .slot > :global(.widget),
        .dashboard.is-editing .slot:nth-child(odd) > :global(.widget) { animation: none; }
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
        .dashboard-edit-btn { display: inline-flex; }
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
