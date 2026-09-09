<!--
    Public marathon training dashboard.

    trainingData computes everything server-side (Strava history in Netlify
    Blobs → deterministic metrics). This component fetches one payload and
    lays it out. No password gate: the page is public, and shape.js drops
    private activities and GPS before anything is stored.

    Panels rearrange the same way /dashboard widgets do (lib/ui/reorder +
    editMode): drop one on another to swap. Free on a wide screen; behind
    the Edit toggle once a press-and-drag would otherwise be a scroll.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import BackLink from "../../lib/ui/BackLink.svelte";
    import EditToggle from "../../lib/ui/EditToggle.svelte";
    import { createRearrangeable } from "../../lib/ui/editMode.svelte.js";
    import Spinner from "../../lib/ui/Spinner.svelte";
    import { fetchJsonSwr } from "../../lib/data/swrCache.js";
    import { createPoller } from "../../lib/data/poller.js";
    import { bestSplit, worthMoving } from "./lib/balance.js";
    import RaceHeader from "./sections/RaceHeader.svelte";
    import SyncNotice from "./sections/SyncNotice.svelte";
    import Today from "./sections/Today.svelte";
    import LastRun from "./sections/LastRun.svelte";
    import Recommendations from "./sections/Recommendations.svelte";
    import VolumeChart from "./sections/VolumeChart.svelte";
    import FitnessChart from "./sections/FitnessChart.svelte";
    import AerobicEfficiency from "./sections/AerobicEfficiency.svelte";
    import LoadRisk from "./sections/LoadRisk.svelte";
    import IntensityMix from "./sections/IntensityMix.svelte";
    import RacePrediction from "./sections/RacePrediction.svelte";
    import WeekPlan from "./sections/WeekPlan.svelte";
    import Recovery from "./sections/Recovery.svelte";
    import RunLog from "./sections/RunLog.svelte";

    const ENDPOINT = "/.netlify/functions/trainingData";
    const STRAVA_PROFILE = "https://www.strava.com/athletes/92118908";

    // Authored reading order. The column split is measured at runtime
    // (lib/balance.js) so a panel added, resized, or dragged doesn't
    // leave one column hundreds of pixels past the other.
    const DEFAULT_ORDER = [
        "lastRun", "recommendations", "volume", "fitness",
        "efficiency", "prediction", "week", "load", "recovery", "intensity",
        "runs",
    ];
    const INITIAL_SPLIT = 4;
    // Bump when the default order changes so a saved layout can't pin
    // the old imbalance or silently drop a new panel.
    const LAYOUT_KEY = "training-layout-4";

    let data = $state(null);
    let error = $state("");
    let stopPoll;

    const { reorder, edit } = createRearrangeable({
        gridId: "training-grid",
        responsiveQuery: "(max-width: 860px)",
        order: DEFAULT_ORDER,
        storageKey: LAYOUT_KEY,
        onReorder: () => requestAnimationFrame(() => window.dispatchEvent(new Event("resize"))),
    });

    let splitAt = $state(INITIAL_SPLIT);

    const columnIds = $derived(reorder.layout.slice(0, -1));
    const wideIds = $derived(columnIds.slice(0, splitAt));
    const narrowIds = $derived(columnIds.slice(splitAt));
    const fullId = $derived(reorder.layout[reorder.layout.length - 1]);
    const todayKey = $derived(data?.today?.date || null);

    const PANELS = {
        lastRun: LastRun,
        volume: VolumeChart,
        fitness: FitnessChart,
        efficiency: AerobicEfficiency,
        recommendations: Recommendations,
        prediction: RacePrediction,
        load: LoadRisk,
        intensity: IntensityMix,
        week: WeekPlan,
        recovery: Recovery,
        runs: RunLog,
    };

    function propsFor(id) {
        switch (id) {
            case "lastRun": return { run: data.lastRun };
            case "volume": return { weeks: data.weeks, today: todayKey };
            case "fitness": return { series: data.series, today: todayKey };
            case "efficiency": return { efficiency: data.efficiency, summary: data.summary, today: todayKey };
            case "recommendations": return { recommendations: data.recommendations };
            case "prediction": return { summary: data.summary };
            case "load": return { acwr: data.summary?.acwr, riskWeek: data.summary?.riskWeek };
            case "intensity": return { intensity: data.summary?.intensity };
            case "week": return { week: data.week, upcoming: data.upcoming };
            case "recovery": return { recovery: data.recovery };
            case "runs": return { runs: data.runs, total: data.summary?.totals?.runs };
            default: return {};
        }
    }

    const MAX_PASSES = 3;

    function rebalance(passesLeft = MAX_PASSES) {
        if (edit.isResponsive) return;
        const grid = document.getElementById("training-grid");
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
            const payload = await fetchJsonSwr(ENDPOINT, {
                maxAgeMs: 60_000,
                onRevalidate: (fresh) => { data = fresh; },
            });
            data = payload;
            error = "";
        } catch (err) {
            if (!data) error = "Couldn't load training data right now.";
            console.error("trainingData load failed", err);
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
        load();
        // Match the upstream sync so an open tab is never more than one
        // cycle behind a reopen. SWR's 60s window and the edge cache sit
        // under this, so each tick actually revalidates.
        stopPoll = createPoller(load, 1000 * 60 * 5, { jitterMs: 30_000 });
    });

    onDestroy(() => {
        stopPoll?.();
        edit.stop();
        clearTimeout(resizeTimer);
        window.removeEventListener("resize", onResize);
    });
</script>

<svelte:head>
    <title>Road to Chicago — Max Eisen</title>
    <meta name="description" content="Live marathon training dashboard: weekly volume, fitness and fatigue, intensity balance, and where I'm projected to finish." />
</svelte:head>

{#snippet panelSlot(id, idx)}
    <div
        class="slot"
        class:drop-target={reorder.dropTargetIdx === idx}
        data-slot-index={idx}
    >
        <div
            class="panel drag-tile"
            class:dragging={reorder.draggingId === id}
            data-panel={id}
            style:transform={reorder.transformFor(id)}
            onpointerdown={(e) => reorder.start(id, e)}
        >
            {@render panelBody(id)}
        </div>
    </div>
{/snippet}

{#snippet panelBody(id)}
    {@const Panel = PANELS[id]}
    {#if Panel}
        <Panel {...propsFor(id)} />
    {/if}
{/snippet}

<main class="training">
    <BackLink />

    {#if data && edit.isResponsive}
        <EditToggle editing={edit.isEditing} onclick={edit.toggle} />
    {/if}

    {#if error && !data}
        <div class="state">
            <p>{error}</p>
        </div>
    {:else if !data}
        <div class="state">
            <Spinner size={38} stroke={3} />
        </div>
    {:else}
        <RaceHeader summary={data.summary} />

        <SyncNotice sync={data.sync} runCount={data.runs?.length ?? 0} />

        <div class="today-strip">
            <Today today={data.today} />
        </div>

        <div
            class="grid drag-grid"
            class:is-editing={edit.isEditing}
            class:is-dragging={reorder.isDragging}
            id="training-grid"
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
            <p>
                Synced from Strava. Metrics are computed deterministically — training load from
                heart-rate reserve, pace adjusted for gradient, and every recommendation shows the
                number that triggered it. No route maps here by design.
            </p>
            <p class="links">
                <a href={STRAVA_PROFILE} target="_blank" rel="noreferrer">Strava profile ↗</a>
            </p>
            {#if data.sync?.lastRunAt}
                <p class="stamp">Last synced {new Date(data.sync.lastRunAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
            {/if}
        </footer>
    {/if}
</main>

<style>
    /* BackLink is fixed top-left. Below 1100px it becomes a 40px circle
       and the eyebrow would sit under it without the extra padding. */
    .training {
        max-width: 1180px;
        margin: 0 auto;
        padding: var(--space-7) var(--space-5) var(--space-8);
    }

    .state {
        min-height: 60vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--paragraph-colour);
    }

    .today-strip {
        margin-bottom: var(--space-4);
        min-width: 0;
    }
    .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
        gap: var(--space-4);
        align-items: start;
        margin-bottom: var(--space-4);
    }
    .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        min-width: 0;
    }
    .col-full { grid-column: 1 / -1; }

    /* Cards sit inside the slot, so the drop outline goes outside
       rather than inset the way the dashboard's does. */
    .slot {
        min-width: 0;
        --drop-outline-offset: 3px;
        --drop-outline-radius: var(--radius-xl);
    }
    /* Grab cursor, swallowed gestures and jiggle live in global.css. */
    .panel {
        position: relative;
        min-width: 0;
    }
    .panel.dragging {
        z-index: 20;
        filter: drop-shadow(0 12px 22px rgba(0, 0, 0, 0.35));
    }
    /* Alternate jiggle by column so the page doesn't rock in lockstep. */
    .grid.is-editing .col:nth-child(even) .panel:not(.dragging) {
        animation-name: edit-jiggle-b;
        animation-duration: 0.46s;
        animation-delay: -0.18s;
    }

    @media (max-width: 1100px) {
        .training { padding-top: 3.5rem; }
    }
    @media (max-width: 860px) {
        .grid { grid-template-columns: minmax(0, 1fr); }
        .training { padding: 3.5rem var(--space-4) var(--space-7); }
        .panel { touch-action: auto; cursor: default; }
        .grid.is-editing .panel { touch-action: none; }
    }

    .foot {
        margin-top: var(--space-6);
        padding-top: var(--space-4);
        border-top: 1px solid var(--main-green-translucent);
    }
    .foot p {
        font-size: var(--font-xs);
        line-height: 1.6;
        color: var(--paragraph-colour);
        opacity: 0.6;
        margin: 0;
        max-width: 70ch;
    }
    .links { margin-top: var(--space-3) !important; opacity: 1 !important; }
    .links a {
        font-size: var(--font-xs);
        color: var(--main-green);
        text-decoration: none;
        opacity: 0.85;
        transition: opacity 0.15s ease;
    }
    .links a:hover, .links a:focus-visible { opacity: 1; text-decoration: underline; }
    .stamp { margin-top: var(--space-2) !important; opacity: 0.45 !important; }
</style>
