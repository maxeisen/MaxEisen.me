<!--
    The page shell shared by /running and /cycling.

    Owns everything the two pages have in common: the nav, the data fetch
    (stale-while-revalidate + a five-minute poll that matches the upstream
    sync), the loading and error states, the rearrangeable two-column panel
    grid with its measured column split, and the footer. A sport page is
    just configuration: which panels, in which order, fed which props, and
    what goes in the header.

    Panels rearrange the way /dashboard widgets do (lib/ui/reorder +
    editMode): drop one on another to swap. Free on a wide screen; behind
    the Edit toggle once a press-and-drag would otherwise be a scroll.

    Props
      endpoint      Netlify function to load
      seed          optional () => payload, for data inlined into the page
      errorMessage  shown if the first load fails
      order         default panel order; the last id spans both columns
      initialSplit  how many panels start in the wide column
      storageKey    localStorage key for the saved order (bump to reset)
      gridId        DOM id for the grid (unique per page)
      panels        { id: Component }
      propsFor      (id, data) => props
      title         (data) => document title
      description   (data) => meta description
      header        snippet(data) → title block + anything above "today"
      today         snippet(data) → the full-width strip above the grid
      footnote      the "where this comes from" paragraph
-->
<script>
    import { onMount, onDestroy, untrack } from "svelte";
    import ModalProvider from "../../lib/ui/ModalProvider.svelte";
    import SiteNav from "../../lib/ui/SiteNav.svelte";
    import EditToggle from "../../lib/ui/EditToggle.svelte";
    import LoadState from "../../lib/ui/LoadState.svelte";
    import { createRearrangeable } from "../../lib/ui/editMode.svelte.js";
    import { fetchJsonSwr, swrSeed } from "../../lib/data/swrCache.js";
    import { createPoller } from "../../lib/data/poller.js";
    import { bestSplit, worthMoving } from "../Training/lib/balance.js";
    import { STRAVA_PROFILE_URL } from "../../lib/strava.js";

    let {
        endpoint,
        seed = null,
        errorMessage = "Couldn't load this right now.",
        order,
        initialSplit = 4,
        storageKey,
        gridId,
        panels,
        propsFor,
        title = () => "Max Eisen",
        description = () => "",
        header = null,
        today = null,
        footnote = "",
    } = $props();

    let data = $state(null);
    let error = $state("");
    let stopPoll;

    // Layout configuration is read once: a page doesn't change its panels
    // or storage key while mounted.
    const { reorder, edit } = untrack(() =>
        createRearrangeable({
            gridId,
            responsiveQuery: "(max-width: 860px)",
            order,
            storageKey,
            onReorder: () => requestAnimationFrame(() => window.dispatchEvent(new Event("resize"))),
        }),
    );

    // The last panel spans the page; the rest split into two columns at a
    // point measured at runtime (lib/balance.js), so a panel added, resized
    // or dragged doesn't leave one column hundreds of pixels past the other.
    let splitAt = $state(untrack(() => initialSplit));
    const columnIds = $derived(reorder.layout.slice(0, -1));
    const wideIds = $derived(columnIds.slice(0, splitAt));
    const narrowIds = $derived(columnIds.slice(splitAt));
    const fullId = $derived(reorder.layout[reorder.layout.length - 1]);

    const MAX_PASSES = 3;

    function rebalance(passesLeft = MAX_PASSES) {
        if (edit.isResponsive) return;
        const grid = document.getElementById(gridId);
        if (!grid) return;

        const measured = new Map();
        for (const panel of grid.querySelectorAll("[data-panel]")) {
            measured.set(panel.dataset.panel, panel.offsetHeight);
        }
        const heights = columnIds.map((id) => measured.get(id) ?? NaN);
        const column = grid.querySelector(".col");
        const gap = column ? parseFloat(getComputedStyle(column).rowGap) || 0 : 0;

        const next = bestSplit(heights, { gap });
        if (!worthMoving(heights, splitAt, next, { gap })) return;
        splitAt = next;
        if (passesLeft > 1) requestAnimationFrame(() => rebalance(passesLeft - 1));
    }

    // Deliberately not reading splitAt: rebalance writes it, and an effect
    // that read it would loop. The rAF callback runs outside the effect.
    $effect(() => {
        void data;
        void reorder.layout;
        void edit.isResponsive;
        requestAnimationFrame(() => rebalance());
    });

    async function load() {
        try {
            const payload = await fetchJsonSwr(endpoint, {
                maxAgeMs: 60_000,
                onRevalidate: (fresh) => { data = fresh; },
            });
            data = payload;
            error = "";
        } catch (err) {
            if (!data) error = errorMessage;
            console.error(`${endpoint} load failed`, err);
        }
    }

    let resizeTimer;
    function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => rebalance(), 150);
    }

    onMount(() => {
        reorder.restore();
        edit.listen();
        window.addEventListener("resize", onResize);
        const boot = seed?.();
        if (boot) {
            swrSeed(endpoint, boot);
            data = boot;
        }
        load();
        stopPoll = createPoller(load, 1000 * 60 * 5, { jitterMs: 30_000 });
    });

    onDestroy(() => {
        stopPoll?.();
        edit.stop();
        clearTimeout(resizeTimer);
        window.removeEventListener("resize", onResize);
    });

    const syncedAt = $derived(
        data?.sync?.lastRunAt
            ? new Date(data.sync.lastRunAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
            : null,
    );
</script>

<svelte:head>
    <title>{title(data)}</title>
    <meta name="description" content={description(data)} />
</svelte:head>

{#snippet panelSlot(id, idx)}
    {@const Panel = panels[id]}
    <div class="slot" class:drop-target={reorder.dropTargetIdx === idx} data-slot-index={idx}>
        <div
            class="panel drag-tile"
            class:dragging={reorder.draggingId === id}
            data-panel={id}
            style:transform={reorder.transformFor(id)}
            onpointerdown={(e) => reorder.start(id, e)}
        >
            {#if Panel}<Panel {...propsFor(id, data)} />{/if}
        </div>
    </div>
{/snippet}

<SiteNav />
<!-- Floats bottom-right; the page's foot padding leaves it room. -->
{#if data && edit.isResponsive}
    <EditToggle editing={edit.isEditing} onclick={edit.toggle} />
{/if}

<!-- ModalProvider gives the activity log a window to open an activity in. -->
<ModalProvider>
    <main class="activity-page">
        {#if error && !data}
            <LoadState {error} />
        {:else if !data}
            <LoadState />
        {:else}
            {@render header?.(data)}

            {#if today}
                <div class="today">{@render today(data)}</div>
            {/if}

            <div
                class="grid drag-grid"
                class:is-editing={edit.isEditing}
                class:is-dragging={reorder.isDragging}
                id={gridId}
            >
                <div class="col">
                    {#each wideIds as id, i (id)}{@render panelSlot(id, i)}{/each}
                </div>
                <div class="col">
                    {#each narrowIds as id, i (id)}{@render panelSlot(id, i + splitAt)}{/each}
                </div>
                <div class="col col-full">
                    {@render panelSlot(fullId, columnIds.length)}
                </div>
            </div>

            <footer class="foot">
                {#if footnote}<p>{footnote}</p>{/if}
                <p class="links">
                    <a href={STRAVA_PROFILE_URL} target="_blank" rel="noreferrer">Strava profile</a>
                    {#if syncedAt}<span class="stamp">Last synced {syncedAt}</span>{/if}
                </p>
            </footer>
        {/if}
    </main>
</ModalProvider>

<style>
    .activity-page {
        max-width: var(--page-max);
        margin: 0 auto;
        padding: var(--space-7) var(--page-gutter) var(--space-8);
    }

    .today { margin-bottom: var(--space-4); min-width: 0; }

    .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
        gap: var(--space-4);
        align-items: start;
    }
    .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        min-width: 0;
    }
    .col-full { grid-column: 1 / -1; }

    .slot { min-width: 0; --drop-outline-offset: 3px; }
    .panel { position: relative; min-width: 0; border-radius: var(--radius); }
    .panel.dragging { z-index: 20; }
    /* Alternate the jiggle by column so the page doesn't rock in lockstep. */
    .grid.is-editing .col:nth-child(even) .panel:not(.dragging) {
        animation-name: edit-jiggle-b;
        animation-duration: 0.46s;
        animation-delay: -0.18s;
    }

    .foot {
        margin-top: var(--space-7);
        padding-top: var(--space-4);
        border-top: 1px solid var(--border);
        font-size: var(--font-xs);
        color: var(--text-2);
    }
    .foot p { margin: 0 0 var(--space-2); max-width: 70ch; color: inherit; line-height: 1.6; }
    .links {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-4);
        color: var(--text-3) !important;
    }
    .links a { font-weight: var(--weight-medium); }

    @media (max-width: 860px) {
        .activity-page { padding-top: var(--space-6); }
        .grid { grid-template-columns: minmax(0, 1fr); }
        .panel { touch-action: auto; cursor: default; }
        .grid.is-editing .panel { touch-action: none; }
    }
</style>
