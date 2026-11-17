<!--
    Dashboard scaffold. Owns:
      - the layout (lib/columnLayout): columns of widgets that always fill
        the window. Drag a gap between columns, or between two widgets in a
        column, to give one more room and its neighbour less; there are no
        set sizes, so a widget can be exactly as big as the information you
        want from it needs. Squeezing the window scales everything together;
        a window too narrow for the columns stacks them into one list.
      - moving widgets (lib/columnDrag): within a column, into another, or
        into a new column at an edge or in a gap, with a live preview of
        where it will land. Layout and which widgets are showing
        (lib/widgetVisibility) are saved in this browser.
      - stepping aside for widgets that can't load: each reports through
        `onavailability`, and one that has nothing to show leaves the layout
        for this visit. It stays mounted and keeps polling, so it comes back
        by itself if its feed recovers; a reload tries every widget afresh.
      - edit mode (lib/ui/editMode, shared with /running): where widgets are
        shown and hidden, and the only way to drag on a touch screen

    Widgets are listed in widgets/registry.js. They are content only:
    Dashboard provides the tile around each one (an <a> for a widget that's
    one big link), and each widget adapts to its tile through container
    queries on `slot`.
-->
<script>
    import { onMount, onDestroy, untrack } from "svelte";
    import SpotifyVizOverlay from "./SpotifyVizOverlay.svelte";
    import SiteNav from "../../lib/ui/SiteNav.svelte";
    import EditToggle from "../../lib/ui/EditToggle.svelte";
    import { createRearrangeable } from "../../lib/ui/editMode.svelte.js";
    import { WIDGETS, WIDGETS_BY_ID } from "./widgets/registry.js";
    import { visibleLayout, computeRects } from "./lib/columnLayout.js";
    import { createColumnDrag } from "./lib/columnDrag.svelte.js";
    import {
        isShown, setShown, readVisibility, writeVisibility, clearVisibility,
    } from "./lib/widgetVisibility.js";

    const LAYOUT_KEY = "dashboard-columns";
    const VISIBILITY_KEY = "dashboard-widgets";
    const WIDGET_IDS = WIDGETS.map((w) => w.id);

    let navHidden = $state(false);
    let fitEl;
    let gridEl = $state();

    // Dragging (moving and resizing) is free with a mouse. On a touch screen
    // a press-and-drag is how you scroll, so there it waits for edit mode —
    // which is offered at every size here, since it's also where widgets
    // are shown and hidden.
    const { reorder, edit } = createRearrangeable({
        gridId: "dashboard-grid",
        responsiveQuery: "(pointer: coarse)",
        editableWhenWide: true,
        createDrag: createColumnDrag,
        order: WIDGET_IDS,
        storageKey: LAYOUT_KEY,
        measure: () => ({ visible, layout, board: gridEl }),
    });

    // Only the choices someone made; see lib/widgetVisibility. Read before
    // the first render, so a hidden widget never mounts (and fetches) for a
    // frame first.
    let choices = $state(readVisibility(VISIBILITY_KEY, WIDGET_IDS));
    const shown = $derived(WIDGETS.filter((w) => isShown(choices, w)));

    // Widgets that couldn't load, this visit only (never saved).
    let unavailable = $state({});
    function setAvailable(id, ok) {
        if (Boolean(unavailable[id]) !== !ok) {
            unavailable = { ...unavailable, [id]: !ok };
        }
    }
    const placed = $derived(shown.filter((w) => !unavailable[w.id]));
    const takesRoom = (id) => isShown(choices, WIDGETS_BY_ID[id]) && !unavailable[id];

    // The grid's content box. Seeded from the window so the first frame is
    // close; the observer corrects it before anything has had time to notice.
    let box = $state({
        width: Math.max(0, window.innerWidth - 64),
        // Less the nav (56) and the grid's padding (16 top, 50 foot).
        height: Math.max(0, window.innerHeight - 122),
    });

    // While dragging a widget, the layout shown is the one a drop would give.
    const visible = $derived(visibleLayout(reorder.shown, takesRoom));
    const layout = $derived(computeRects(visible, box));
    const scrolls = $derived(layout.height > box.height + 0.5);
    // The dragged widget's tile stays where it started (it follows the
    // pointer from there); a placeholder shows where it would land.
    $effect(() => {
        if (!reorder.isDragging && fitEl) untrack(measureBox);
    });
    const placeOf = (id) => (id === reorder.draggingId ? reorder.origin : layout.rects[id]);

    function setWidgetShown(id, on) {
        choices = setShown(choices, id, on);
        writeVisibility(VISIBILITY_KEY, choices);
    }

    // For each widget that couldn't load, a hidden one to offer in its place.
    const suggestions = $derived.by(() => {
        const spare = WIDGETS.filter((w) => !isShown(choices, w) && !unavailable[w.id]);
        return shown
            .filter((w) => unavailable[w.id])
            .map((failed, i) => ({ failed, alt: spare[i] }))
            .filter(({ alt }) => alt);
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

    // Arrow keys on a focused gap nudge it, for keyboards.
    function nudge(handle, event) {
        const step = event.shiftKey ? 64 : 16;
        const keys = handle.kind === "col"
            ? { ArrowLeft: -step, ArrowRight: step }
            : { ArrowUp: -step, ArrowDown: step };
        if (!(event.key in keys)) return;
        event.preventDefault();
        reorder.nudge(handle, keys[event.key]);
    }

    const handleLabel = (handle) => {
        if (handle.kind === "col") return "Resize columns";
        const items = visible[handle.col]?.items ?? [];
        const above = WIDGETS_BY_ID[items[handle.index]?.id]?.title ?? "";
        const below = WIDGETS_BY_ID[items[handle.index + 1]?.id]?.title ?? "";
        return `Resize ${above} and ${below}`;
    };

    // Tiles glide when the arrangement changes (a drag preview, a drop, a
    // widget shown or hidden), but track instantly while a gap is dragged or
    // the window resized: the arrangement's key ignores sizes.
    const arrangement = $derived(visible.map((col) => col.items.map((item) => item.id).join()).join("|"));
    let glide = $state(false);
    let glideTimer;
    $effect.pre(() => {
        void arrangement;
        untrack(() => {
            glide = true;
            clearTimeout(glideTimer);
            glideTimer = setTimeout(() => { glide = false; }, 260);
        });
    });

    // Watches the wrapper rather than the window: the box also changes when
    // the nav is tucked away or the customize bar opens. The wrapper's size
    // never depends on the grid inside it (the grid scrolls within it), so
    // measuring can't feed back into itself.
    let observer;
    function measureBox() {
        // A drag changes the wrapper's overflow (so the tile can leave it),
        // which can add or drop a scrollbar gutter; the layout holds still
        // until it's over.
        if (reorder.isDragging) return;
        const style = getComputedStyle(fitEl);
        const width = Math.floor(fitEl.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
        const height = Math.floor(fitEl.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
        if (width !== box.width || height !== box.height) box = { width, height };
    }

    onMount(() => {
        edit.listen();
        observer = new ResizeObserver(measureBox);
        observer.observe(fitEl);
        measureBox();
    });

    onDestroy(() => {
        edit.stop();
        observer?.disconnect();
        clearTimeout(glideTimer);
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
            <p class="customize-hint">Drag a gap between widgets to resize them. Drag a widget to an edge or a gap to start a new column.</p>
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
        class:is-scrolling={scrolls}
        class:is-dragging={reorder.isDragging}
        bind:this={fitEl}
    >
        <div
            class="dashboard-grid drag-grid"
            class:is-editing={edit.isEditing}
            class:is-dragging={reorder.isDragging}
            class:is-resizing={reorder.resizing}
            class:glide
            bind:this={gridEl}
            id="dashboard-grid"
            data-fit={!scrolls}
            style:height="{layout.height}px"
        >
            {#if reorder.draggingId && layout.rects[reorder.draggingId]}
                {@const landing = layout.rects[reorder.draggingId]}
                <div
                    class="drop-placeholder"
                    aria-hidden="true"
                    style:left="{landing.x}px"
                    style:top="{landing.y}px"
                    style:width="{landing.w}px"
                    style:height="{landing.h}px"
                ></div>
            {/if}
            {#each shown as widget (widget.id)}
                {@const place = placeOf(widget.id)}
                <div
                    class="slot"
                    class:is-dragging={reorder.draggingId === widget.id}
                    hidden={!place}
                    style:left={place ? `${place.x}px` : null}
                    style:top={place ? `${place.y}px` : null}
                    style:width={place ? `${place.w}px` : null}
                    style:height={place ? `${place.h}px` : null}
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
            {#if !reorder.isDragging}
                {#each layout.handles as handle (`${handle.kind}-${handle.col}-${handle.index ?? ""}`)}
                    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
                    <div
                        class="handle handle-{handle.kind}"
                        class:active={reorder.resizing && reorder.resizing.kind === handle.kind
                            && reorder.resizing.col === handle.col && reorder.resizing.index === handle.index}
                        role="separator"
                        tabindex="0"
                        aria-orientation={handle.kind === "col" ? "vertical" : "horizontal"}
                        aria-label={handleLabel(handle)}
                        data-edit-control
                        style:left="{handle.x}px"
                        style:top="{handle.y}px"
                        style:width={handle.kind === "row" ? `${handle.w}px` : null}
                        style:height={handle.kind === "col" ? `${handle.h}px` : null}
                        onpointerdown={(e) => reorder.startResize(handle, e)}
                        onkeydown={(e) => nudge(handle, e)}
                    ><span class="grip"></span></div>
                {/each}
            {/if}
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

    /* Every tile is placed by lib/columnLayout, in px; the grid is only the
       box they're placed in (its height is set too, so it can scroll). */
    .dashboard-grid {
        position: relative;
    }

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
        position: absolute;
        container-type: size;
        container-name: slot;
    }
    /* A rearrangement glides; resizing (a gap or the window) tracks. */
    .dashboard-grid.glide .slot:not(.is-dragging) {
        transition:
            left 220ms cubic-bezier(0.2, 0, 0, 1),
            top 220ms cubic-bezier(0.2, 0, 0, 1),
            width 220ms cubic-bezier(0.2, 0, 0, 1),
            height 220ms cubic-bezier(0.2, 0, 0, 1);
    }
    @media (prefers-reduced-motion: reduce) {
        .dashboard-grid.glide .slot { transition: none; }
    }
    .slot.is-dragging { z-index: 20; }

    /* Where the dragged widget will land. */
    .drop-placeholder {
        position: absolute;
        box-sizing: border-box;
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

    /* The gaps between widgets are the resize handles: invisible at rest,
       a grip on hover, a line while dragging. */
    .handle {
        position: absolute;
        z-index: 4;
        display: flex;
        align-items: center;
        justify-content: center;
        touch-action: none;
        outline: none;
    }
    .handle-col { width: var(--space-4); cursor: col-resize; }
    .handle-row { height: var(--space-4); cursor: row-resize; }
    .grip {
        border-radius: var(--radius-pill);
        background: var(--text-3);
        opacity: 0;
        transition: opacity var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
    }
    .handle-col .grip { width: 4px; height: 40px; max-height: 60%; }
    .handle-row .grip { height: 4px; width: 40px; max-width: 60%; }
    .handle:hover .grip,
    .handle:focus-visible .grip,
    .dashboard-grid.is-editing .grip { opacity: 0.6; }
    .handle.active .grip {
        opacity: 1;
        background: var(--accent);
    }
    .handle-col.active .grip { height: 100%; max-height: none; }
    .handle-row.active .grip { width: 100%; max-width: none; }
    .handle:focus-visible .grip { background: var(--accent); }
    .dashboard-grid.is-resizing { cursor: inherit; user-select: none; }
    /* On a touch screen the gaps, like the tiles, wait for edit mode. */
    @media (pointer: coarse) {
        .dashboard-grid:not(.is-editing) .handle { pointer-events: none; }
    }

    .customize-hint {
        flex-basis: 100%;
        margin: 0;
        font-size: var(--font-xs);
        color: var(--text-3);
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
