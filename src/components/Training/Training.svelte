<!--
    Public marathon training dashboard.

    Everything is computed server-side by trainingData (which reads the synced
    Strava history out of Netlify Blobs and runs the deterministic metrics
    engine), so this component only fetches one payload and lays it out. No
    password gate: the page is public on purpose, and the payload carries no
    private activities and no GPS — see netlify/functions/_shared/training/
    shape.js for how that's enforced.

    Panels rearrange exactly the way /dashboard's widgets do, running the same
    code (lib/ui/reorder for the drag, lib/ui/editMode for when it's allowed):
    grab a panel and drop it on another to swap them, free on a wide screen,
    behind the Edit toggle once the layout is narrow enough that a press-and-
    drag would otherwise be a scroll.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import BackLink from "../../lib/ui/BackLink.svelte";
    import EditToggle from "../../lib/ui/EditToggle.svelte";
    import { createRearrangeable } from "../../lib/ui/editMode.svelte.js";
    import Spinner from "../../lib/ui/Spinner.svelte";
    import { fetchJsonSwr } from "../../lib/data/swrCache.js";
    import { createPoller } from "../../lib/data/poller.js";
    import RaceHeader from "./sections/RaceHeader.svelte";
    import SyncNotice from "./sections/SyncNotice.svelte";
    import Recommendations from "./sections/Recommendations.svelte";
    import VolumeChart from "./sections/VolumeChart.svelte";
    import FitnessChart from "./sections/FitnessChart.svelte";
    import AerobicEfficiency from "./sections/AerobicEfficiency.svelte";
    import LoadRisk from "./sections/LoadRisk.svelte";
    import IntensityMix from "./sections/IntensityMix.svelte";
    import RacePrediction from "./sections/RacePrediction.svelte";
    import WeekPlan from "./sections/WeekPlan.svelte";
    import RunLog from "./sections/RunLog.svelte";

    const ENDPOINT = "/.netlify/functions/trainingData";

    // Slots 0–3 are the wide column, 4–7 the narrow one, 8 the full-width
    // row underneath. A panel can sit in any of them; the charts and the run
    // log all reflow to their container, so a "narrow" chart is a narrower
    // chart rather than a broken one.
    const DEFAULT_ORDER = [
        "volume", "fitness", "efficiency", "recommendations",
        "prediction", "load", "intensity", "week",
        "runs",
    ];
    const WIDE_SLOTS = 4;
    const NARROW_SLOTS = 4;
    const LAYOUT_KEY = "training-layout";

    let data = $state(null);
    let error = $state("");
    let stopPoll;

    const { reorder, edit } = createRearrangeable({
        gridId: "training-grid",
        // Where the two columns become one, which is also where a press-and-
        // drag stops being spare and starts being how you scroll.
        responsiveQuery: "(max-width: 860px)",
        order: DEFAULT_ORDER,
        storageKey: LAYOUT_KEY,
        // Charts size themselves off their container, so a swap between the
        // wide and narrow columns needs them to re-measure.
        onReorder: () => requestAnimationFrame(() => window.dispatchEvent(new Event("resize"))),
    });

    const wideIds = $derived(reorder.layout.slice(0, WIDE_SLOTS));
    const narrowIds = $derived(reorder.layout.slice(WIDE_SLOTS, WIDE_SLOTS + NARROW_SLOTS));
    const fullId = $derived(reorder.layout[WIDE_SLOTS + NARROW_SLOTS]);

    const currentWeek = $derived(
        data?.weeks?.find((w) => w.start === weekStartOf(data.today)) || null,
    );

    // Monday of a given day key, mirroring the server's week anchoring.
    function weekStartOf(dayKey) {
        if (!dayKey) return null;
        const date = new Date(`${dayKey}T12:00:00Z`);
        if (Number.isNaN(date.getTime())) return null;
        const dow = date.getUTCDay();
        date.setUTCDate(date.getUTCDate() - (dow === 0 ? 6 : dow - 1));
        return date.toISOString().slice(0, 10);
    }

    async function load() {
        try {
            const payload = await fetchJsonSwr(ENDPOINT, {
                maxAgeMs: 60_000,
                onRevalidate: (fresh) => { data = fresh; },
            });
            data = payload;
            error = "";
        } catch (err) {
            // Keep whatever we already rendered; only a cold failure is fatal.
            if (!data) error = "Couldn't load training data right now.";
            console.error("trainingData load failed", err);
        }
    }

    onMount(() => {
        document.body.classList.add("training-page");
        reorder.restore();
        edit.listen();
        load();

        // The upstream sync runs hourly, so there's nothing to gain from
        // polling hard — this is really just to catch a sync landing while
        // the tab is left open.
        stopPoll = createPoller(load, 1000 * 60 * 10, { jitterMs: 30_000 });
    });

    onDestroy(() => {
        stopPoll?.();
        edit.stop();
        document.body.classList.remove("training-page");
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
    {#if id === "volume"}
        <VolumeChart weeks={data.weeks} today={data.today} />
    {:else if id === "fitness"}
        <FitnessChart series={data.series} today={data.today} />
    {:else if id === "efficiency"}
        <AerobicEfficiency efficiency={data.efficiency} summary={data.summary} today={data.today} />
    {:else if id === "recommendations"}
        <Recommendations recommendations={data.recommendations} />
    {:else if id === "prediction"}
        <RacePrediction summary={data.summary} />
    {:else if id === "load"}
        <LoadRisk acwr={data.summary?.acwr} riskWeek={data.summary?.riskWeek} />
    {:else if id === "intensity"}
        <IntensityMix intensity={data.summary?.intensity} />
    {:else if id === "week"}
        <WeekPlan {currentWeek} week={data.week} upcoming={data.upcoming} />
    {:else if id === "runs"}
        <RunLog runs={data.runs} total={data.summary?.totals?.runs} />
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
                {#each narrowIds as id, i (id)}{@render panelSlot(id, i + WIDE_SLOTS)}{/each}
            </div>

            <div class="col col-full">
                {@render panelSlot(fullId, WIDE_SLOTS + NARROW_SLOTS)}
            </div>
        </div>

        <footer class="foot">
            <p>
                Synced from Strava. Metrics are computed deterministically — training load from
                heart-rate reserve, pace adjusted for gradient, and every recommendation shows the
                number that triggered it. No route maps here by design.
            </p>
            {#if data.generatedAt}
                <p class="stamp">Updated {new Date(data.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
            {/if}
        </footer>
    {/if}
</main>

<style>
    /* The back link is fixed to the viewport's top-left, so the page has to
       leave it room: at full width the container is centred well clear of it,
       but once it reaches the edges the "Training for" eyebrow lands directly
       under the button. Below 1100px that link becomes a 40px circle, hence
       the extra clearance there. */
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

    /* Cards sit inside their slot, so the drop outline goes outside rather
       than inset the way the dashboard's does. */
    .slot {
        min-width: 0;
        --drop-outline-offset: 3px;
        --drop-outline-radius: var(--radius-xl);
    }
    /* The grab cursor, the swallowed gestures and the jiggle are in
       global.css under "Rearrangeable grids", shared with /dashboard. What's
       left here is what this page does differently. */
    .panel {
        position: relative;
        min-width: 0;
    }
    .panel.dragging {
        z-index: 20;
        /* The card surfaces are translucent, so a panel in flight would
           otherwise read as part of whatever it's passing over. */
        filter: drop-shadow(0 12px 22px rgba(0, 0, 0, 0.35));
    }
    /* The second column takes the other jiggle, so the page doesn't rock in
       lockstep — the dashboard alternates by slot, this by column. */
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
        /* A finger scrolls the page until edit mode says otherwise. */
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
    .stamp { margin-top: var(--space-2) !important; opacity: 0.45 !important; }
</style>
