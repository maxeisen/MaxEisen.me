<!--
    Dashboard scaffold. Owns:
      - the grid: lib/gridLayout picks a column count and packs the widgets
        for whatever box the window leaves, filling it until rows would get
        too short, then scrolling
      - the layout (widget order, persisted) and dragging it (lib/gridDrag:
        a live preview of where the widget will land, then a short glide
        into place) and which widgets are showing (persisted,
        lib/widgetVisibility)
      - stepping aside for widgets that can't load: each reports through
        `onavailability`, and one that has nothing to show leaves the grid
        for this visit. It stays mounted and keeps polling, so it comes back
        by itself if its feed recovers; a reload tries every widget afresh.
      - edit mode (lib/ui/editMode, shared with /running): where widgets are
        shown and hidden, and the only way to drag on a touch screen

    Widgets are listed in widgets/registry.js, each with its size. They are
    content only: Dashboard provides the tile around each one (an <a> for a
    widget that's one big link), and each widget adapts to its tile through
    container queries on `slot`.
-->
<script>
    import { onMount, onDestroy, untrack } from "svelte";
    import SpotifyVizOverlay from "./SpotifyVizOverlay.svelte";
    import SiteNav from "../../lib/ui/SiteNav.svelte";
    import EditToggle from "../../lib/ui/EditToggle.svelte";
    import { createRearrangeable } from "../../lib/ui/editMode.svelte.js";
    import { WIDGETS, WIDGETS_BY_ID } from "./widgets/registry.js";
    import { chooseLayout } from "./lib/gridLayout.js";
    import { createGridDrag } from "./lib/gridDrag.svelte.js";
    import {
        isShown, setShown, readVisibility, writeVisibility, clearVisibility,
    } from "./lib/widgetVisibility.js";

    const LAYOUT_KEY = "dashboard-layout";
    const VISIBILITY_KEY = "dashboard-widgets";
    const WIDGET_IDS = WIDGETS.map((w) => w.id);

    let navHidden = $state(false);
    let fitEl;
    let gridEl;

    // Dragging is free with a mouse. On a touch screen a press-and-drag is
    // how you scroll, so there it waits for edit mode — which is offered at
    // every size here, since it's also where widgets are shown and hidden.
    const { reorder, edit } = createRearrangeable({
        gridId: "dashboard-grid",
        responsiveQuery: "(pointer: coarse)",
        editableWhenWide: true,
        createDrag: createGridDrag,
        order: WIDGET_IDS,
        storageKey: LAYOUT_KEY,
        measure: measureGrid,
    });
    const layout = $derived(reorder.layout);

    // Only the choices someone made; see lib/widgetVisibility. Read before
    // the first render, so a hidden widget never mounts (and fetches) for a
    // frame first.
    let choices = $state(readVisibility(VISIBILITY_KEY, WIDGET_IDS));
    const shown = $derived(
        layout.map((id) => WIDGETS_BY_ID[id]).filter((w) => w && isShown(choices, w)),
    );

    // Widgets that couldn't load, this visit only (never saved).
    let unavailable = $state({});
    function setAvailable(id, ok) {
        if (Boolean(unavailable[id]) !== !ok) {
            unavailable = { ...unavailable, [id]: !ok };
        }
    }
    const placed = $derived(shown.filter((w) => !unavailable[w.id]));

    // While dragging, the grid shows the order a drop would give.
    const arranged = $derived.by(() => {
        if (!reorder.preview) return placed;
        const live = new Set(placed.map((w) => w.id));
        return reorder.preview.filter((id) => live.has(id)).map((id) => WIDGETS_BY_ID[id]);
    });
    // The same widgets in registry order: what the column count is decided
    // from, so rearranging never changes it (see lib/gridLayout).
    const canonical = $derived.by(() => {
        const live = new Set(placed.map((w) => w.id));
        return WIDGETS.filter((w) => live.has(w.id));
    });
    const asItems = (widgets) => widgets.map((w) => ({ id: w.id, ...w.size }));

    function setWidgetShown(id, shown) {
        choices = setShown(choices, id, shown);
        writeVisibility(VISIBILITY_KEY, choices);
    }

    // For each widget that couldn't load, a hidden one to offer in its place:
    // the same size if there is one, so the grid barely moves.
    const suggestions = $derived.by(() => {
        const spare = WIDGETS.filter((w) => !isShown(choices, w) && !unavailable[w.id]);
        const taken = new Set();
        const out = [];
        for (const failed of shown.filter((w) => unavailable[w.id])) {
            const free = spare.filter((w) => !taken.has(w.id));
            const alt = free.find((w) => w.size.w === failed.size.w && w.size.h === failed.size.h) ?? free[0];
            if (!alt) continue;
            taken.add(alt.id);
            out.push({ failed, alt });
        }
        return out;
    });

    function swapIn(failedId, altId) {
        reorder.swap(failedId, altId);
        choices = setShown(setShown(choices, failedId, false), altId, true);
        writeVisibility(VISIBILITY_KEY, choices);
    }

    function resetLayout() {
        reorder.reset();
        choices = {};
        clearVisibility(VISIBILITY_KEY);
    }

    // The grid's content box. Seeded from the window so the first frame is
    // close; the observer corrects it before anything has had time to notice.
    let box = $state({
        width: Math.max(0, window.innerWidth - 64),
        // Less the nav (56) and the grid's padding (16 top, 50 foot).
        height: Math.max(0, window.innerHeight - 122),
        gap: 16,
    });
    const grid = $derived(
        chooseLayout(asItems(arranged), box, { colsFrom: asItems(canonical) }),
    );
    // The dragged widget's slot stays where it started (its tile follows the
    // pointer from there); everything else takes the previewed layout.
    const placeOf = (id) => (id === reorder.draggingId ? reorder.origin : grid.placements[id]);
    const templateRows = $derived(
        grid.fit
            ? `repeat(${grid.rows}, minmax(0, 1fr))`
            : `repeat(${grid.rows}, ${grid.rowHeight}px)`,
    );

    // Watches the wrapper rather than the window: the box also changes when
    // the nav is tucked away or the customize bar opens. The wrapper's size
    // never depends on the grid inside it (the grid scrolls within it), so
    // measuring can't feed back into itself.
    let observer;
    function measureBox(rect) {
        const gap = parseFloat(getComputedStyle(gridEl).rowGap) || 0;
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        if (width !== box.width || height !== box.height || gap !== box.gap) {
            box = { width, height, gap };
        }
    }

    // What a drag needs to know about the grid as it starts. Rows and columns
    // are measured off the rendered grid, so this holds in fitted and
    // scrolling layouts alike.
    function measureGrid() {
        const rect = gridEl.getBoundingClientRect();
        const gap = box.gap;
        return {
            items: asItems(arranged),
            cols: grid.cols,
            placements: grid.placements,
            grid: gridEl,
            colPitch: (rect.width + gap) / grid.cols,
            rowPitch: (rect.height + gap) / grid.rows,
        };
    }

    // FLIP: when the arrangement changes (a drag preview, a drop, a widget
    // shown or hidden — not a window resize), each tile glides from where it
    // was to where it now is. Positions are read just before the DOM updates
    // and again just after; the difference is animated on `translate`, which
    // leaves `transform` to the drag and the edit-mode jiggle.
    const arrangement = $derived(`${arranged.map((w) => w.id).join()}|${reorder.draggingId ?? ""}`);
    let before = null;
    function tileRects() {
        const rects = {};
        for (const el of gridEl.querySelectorAll(".slot > .widget")) {
            rects[el.dataset.widget] = el.getBoundingClientRect();
        }
        return rects;
    }
    $effect.pre(() => {
        void arrangement;
        if (gridEl) before = untrack(tileRects);
    });
    $effect(() => {
        void arrangement;
        const from = before;
        before = null;
        if (!from || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const dragging = untrack(() => reorder.draggingId);
        for (const el of gridEl.querySelectorAll(".slot > .widget")) {
            const id = el.dataset.widget;
            const was = from[id];
            if (id === dragging || !was || !was.width) continue;
            const now = el.getBoundingClientRect();
            const dx = was.left - now.left;
            const dy = was.top - now.top;
            if (!now.width || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) continue;
            el.animate(
                [{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }],
                { duration: 220, easing: "cubic-bezier(0.2, 0, 0, 1)" },
            );
        }
    });

    onMount(() => {
        reorder.restore();
        edit.listen();
        observer = new ResizeObserver(([entry]) => measureBox(entry.contentRect));
        observer.observe(fitEl);
    });

    onDestroy(() => {
        edit.stop();
        observer?.disconnect();
    });
</script>

<svelte:head>
    <title>Dashboard — Max Eisen</title>
    <meta name="robots" content="noindex"/>
    <link rel="canonical" href="https://maxeisen.me/dashboard"/>
</svelte:head>

<SiteNav sticky={false} hideable bind:hidden={navHidden} />
<EditToggle editing={edit.isEditing} onclick={edit.toggle} />

<div class="dashboard" class:nav-hidden={navHidden}>
    {#if edit.isEditing}
        <div class="customize" role="group" aria-label="Widgets to show">
            <span class="customize-label">Widgets</span>
            <div class="customize-list">
                {#each WIDGETS as widget (widget.id)}
                    {@const on = isShown(choices, widget)}
                    {@const failed = on && unavailable[widget.id]}
                    <button
                        class="chip"
                        class:on
                        class:failed
                        type="button"
                        aria-pressed={on ? "true" : "false"}
                        title={failed ? `${widget.description} (couldn't load just now)` : widget.description}
                        onclick={() => setWidgetShown(widget.id, !on)}
                    >{widget.title}{#if failed}<span class="chip-note"> · unavailable</span>{/if}</button>
                {/each}
            </div>
            <button class="reset" type="button" onclick={resetLayout}>Reset layout</button>
            {#each suggestions as { failed, alt } (failed.id)}
                <p class="suggest">
                    {failed.title} couldn't load.
                    <button class="suggest-btn" type="button" onclick={() => swapIn(failed.id, alt.id)}>Show {alt.title} in its place</button>
                </p>
            {/each}
        </div>
    {/if}

    <div
        class="dashboard-fit"
        class:is-scrolling={!grid.fit}
        class:is-dragging={reorder.isDragging}
        bind:this={fitEl}
    >
        <div
            class="dashboard-grid drag-grid"
            class:is-editing={edit.isEditing}
            class:is-dragging={reorder.isDragging}
            bind:this={gridEl}
            id="dashboard-grid"
            data-cols={grid.cols}
            data-fit={grid.fit}
            style:grid-template-columns="repeat({grid.cols}, minmax(0, 1fr))"
            style:grid-template-rows={templateRows}
        >
            {#if reorder.draggingId && grid.placements[reorder.draggingId]}
                {@const landing = grid.placements[reorder.draggingId]}
                <div
                    class="drop-placeholder"
                    aria-hidden="true"
                    style:grid-column="{landing.x + 1} / span {landing.w}"
                    style:grid-row="{landing.y + 1} / span {landing.h}"
                ></div>
            {/if}
            {#each shown as widget (widget.id)}
                {@const place = placeOf(widget.id)}
                <div
                    class="slot"
                    class:is-dragging={reorder.draggingId === widget.id}
                    hidden={!place}
                    style:grid-column={place ? `${place.x + 1} / span ${place.w}` : null}
                    style:grid-row={place ? `${place.y + 1} / span ${place.h}` : null}
                >
                    <svelte:element
                        this={widget.href ? "a" : "div"}
                        href={widget.href}
                        class="widget surface drag-tile widget-{widget.id}"
                        class:dragging={reorder.draggingId === widget.id}
                        data-widget={widget.id}
                        style:transform={reorder.transformFor(widget.id)}
                        onpointerdown={(e) => reorder.start(widget.id, e)}
                    >
                        <widget.component {...widget.props} onavailability={(ok) => setAvailable(widget.id, ok)} />
                    </svelte:element>
                    {#if edit.isEditing && reorder.draggingId !== widget.id}
                        <button
                            class="hide-btn"
                            type="button"
                            data-edit-control
                            aria-label="Hide {widget.title}"
                            title="Hide {widget.title}"
                            onpointerdown={(e) => e.stopPropagation()}
                            onclick={() => setWidgetShown(widget.id, false)}
                        >
                            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6"/></svg>
                        </button>
                    {/if}
                </div>
            {/each}
        </div>

        {#if !placed.length}
            <div class="dashboard-empty">
                <p>{shown.length ? "None of the widgets you've picked could load." : "Every widget is hidden."}</p>
                {#if !edit.isEditing}
                    <button class="reset" type="button" onclick={edit.toggle}>Choose widgets</button>
                {/if}
            </div>
        {/if}
    </div>
</div>

<SpotifyVizOverlay />

<style>
    /* A wall display, not a page: the dashboard is exactly the window under
       the nav, and when the widgets can't fit, the grid scrolls inside it. */
    .dashboard {
        display: flex;
        flex-direction: column;
        height: calc(100vh - var(--nav-height) - 1px);
        height: calc(100dvh - var(--nav-height) - 1px);
    }
    /* With the nav tucked away the grid takes the whole viewport, leaving a
       gutter at the top for the tab that brings the nav back. */
    .dashboard.nav-hidden {
        height: 100vh;
        height: 100dvh;
        padding-top: 10px;
    }

    /* The foot is deeper than the rest of the padding: it's where the
       floating Edit toggle sits, clear of the widgets. */
    .dashboard-fit {
        position: relative;
        flex: 1;
        min-height: 0;
        padding: var(--space-4) var(--page-gutter) 50px;
        overflow: hidden;
        /* So a scrollbar arriving doesn't narrow the box and re-trigger a
           layout. Overlay scrollbars (macOS) take no room either way. */
        scrollbar-gutter: stable;
    }
    .dashboard-fit.is-scrolling {
        overflow-y: auto;
        overscroll-behavior: contain;
    }
    /* A fitted grid clips at the window edge; let a dragged tile leave it. */
    .dashboard-fit.is-dragging:not(.is-scrolling) { overflow: visible; }

    .dashboard-grid {
        display: grid;
        gap: var(--space-4);
        height: 100%;
    }
    .dashboard-fit.is-scrolling .dashboard-grid { height: auto; }

    /* Widget surface comes from the global .surface class (the same as a
       Card); a widget also has to be a flex column that clips its overflow.
       Padding is a pair of variables so widgets can size things against
       what's left of their slot (e.g. Spotify's art). */
    :global(.widget) {
        --widget-pad-y: 20px;
        --widget-pad-x: 20px;
        position: relative;
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        padding: var(--widget-pad-y) var(--widget-pad-x);
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

    /* Each slot is a size container: widgets query its width and height to
       pick their compact or roomy layouts. Containment also makes the slot
       its own stacking context, so a dragged widget can only rise above the
       others if its slot does. */
    .slot {
        display: flex;
        min-width: 0;
        min-height: 0;
        position: relative;
        container-type: size;
        container-name: slot;
    }
    .slot.is-dragging { z-index: 20; }

    /* Where the dragged widget will land. */
    .drop-placeholder {
        border: 2px dashed var(--accent);
        border-radius: var(--radius);
        background: color-mix(in oklab, var(--accent) 7%, transparent);
        pointer-events: none;
    }
    .slot[hidden] { display: none; }
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

    /* Tighter padding as tiles shrink, for every widget. */
    @container slot (max-height: 200px) {
        :global(.widget) { --widget-pad-y: 12px; --widget-pad-x: 16px; }
    }
    @container slot (max-height: 110px) {
        :global(.widget) { --widget-pad-y: 10px; }
    }
    @container slot (max-width: 260px) {
        :global(.widget) { --widget-pad-x: 14px; }
    }

    /* === edit mode ===
       Alternate slots take the second jiggle so the grid doesn't rock in
       lockstep. */
    .dashboard-grid.is-editing .slot:nth-child(odd) > :global(.widget:not(.dragging)) {
        animation-name: edit-jiggle-b;
        animation-duration: 0.46s;
        animation-delay: -0.18s;
    }

    .hide-btn {
        position: absolute;
        top: -6px;
        left: -6px;
        z-index: 5;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border: 1px solid var(--border-strong);
        border-radius: 50%;
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow-pop);
        cursor: pointer;
    }
    .hide-btn:hover { background: var(--surface-2); color: var(--text-strong); }
    .hide-btn svg {
        width: 10px;
        height: 10px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
    }

    .customize {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-3);
        padding: var(--space-4) var(--page-gutter) 0;
    }
    .customize-label {
        font-size: var(--font-xs);
        font-weight: var(--weight-medium);
        color: var(--text-2);
    }
    .customize-list {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        gap: var(--space-2);
    }
    .chip,
    .reset {
        height: 30px;
        padding: 0 12px;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-pill);
        background: transparent;
        color: var(--text-2);
        font: inherit;
        font-size: var(--font-xs);
        font-weight: var(--weight-medium);
        white-space: nowrap;
        cursor: pointer;
        transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
    }
    .chip:hover,
    .reset:hover { background: var(--surface-2); color: var(--text-strong); }
    .chip.on {
        border-color: var(--text-strong);
        background: var(--text-strong);
        color: var(--bg);
    }
    .chip.failed { opacity: 0.6; }
    .suggest {
        flex-basis: 100%;
        margin: 0;
        font-size: var(--font-xs);
        color: var(--text-2);
    }
    .suggest-btn {
        margin-left: var(--space-1);
        padding: 0;
        border: 0;
        background: none;
        color: var(--accent);
        font: inherit;
        font-weight: var(--weight-medium);
        cursor: pointer;
    }
    .suggest-btn:hover { text-decoration: underline; }
    .chip-note { font-weight: var(--weight-regular); }
    .reset { border-radius: var(--radius); }

    .dashboard-empty {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-3);
        color: var(--text-2);
        font-size: var(--font-sm);
    }
    .dashboard-empty p { margin: 0; }

    /* On a touch screen a finger scrolls until edit mode says otherwise. */
    @media (pointer: coarse) {
        .slot > :global(.widget) { touch-action: auto; cursor: default; }
        .dashboard-grid.is-editing .slot > :global(.widget) { touch-action: none; }
    }
</style>
