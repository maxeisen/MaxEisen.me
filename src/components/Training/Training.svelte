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
    import { bestSplit, worthMoving } from "./lib/balance.js";
    import RaceHeader from "./sections/RaceHeader.svelte";
    import SyncNotice from "./sections/SyncNotice.svelte";
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

    // The raw feed behind all of this, for anyone who wants to check the work.
    // /dashboard's Strava widget used to point here; it now points at this page.
    const STRAVA_PROFILE = "https://www.strava.com/athletes/92118908";

    // The panels in order, filling the wide column and then the narrow one,
    // with the last taking the full-width row underneath. A panel can sit
    // anywhere; the charts and the run log all reflow to their container, so a
    // "narrow" chart is a narrower chart rather than a broken one.
    //
    // The order carries the argument and is authored: what just happened, what
    // to do about it, then how the training is trending, then the reference
    // material. Where the two columns divide is not authored — that's measured
    // at runtime, because the columns are independent and a heavy one simply
    // runs on past the other. It used to be a constant, which was right until
    // a panel was added or resized, and both kept happening. See lib/balance.js.
    //
    // Recommendations sits second rather than at the top of the right column.
    // It's the tallest panel on the page by some margin — a thousand pixels of
    // prose — and with it leading the narrow column no split of the remaining
    // order could bring the two within 500px of each other. It also reads
    // better here: the advice is the point of the page, and the wide column is
    // where long text belongs.
    const DEFAULT_ORDER = [
        "lastRun", "recommendations", "volume", "fitness",
        "efficiency", "prediction", "week", "load", "recovery", "intensity",
        "runs",
    ];
    // Where the split starts before anything has been measured, and what it
    // falls back to if measuring isn't possible.
    const INITIAL_SPLIT = 4;
    // Versioned: a layout saved against the old order would keep the imbalance
    // this fixes, and the arrangement is a convenience rather than anything
    // worth carrying forward at the cost of the fix.
    // 3: recovery joins the narrow column. A saved layout of ten panels can't
    //    place an eleventh, so the stored order would silently drop it.
    // 4: recommendations moves up the order. A layout saved against the old
    //    one would pin the imbalance this fixes, and the split is computed
    //    from the order it's given rather than able to rescue any order.
    const LAYOUT_KEY = "training-layout-4";

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

    // The last panel spans both columns, so only the ones above it are split.
    let splitAt = $state(INITIAL_SPLIT);

    const columnIds = $derived(reorder.layout.slice(0, -1));
    const wideIds = $derived(columnIds.slice(0, splitAt));
    const narrowIds = $derived(columnIds.slice(splitAt));
    const fullId = $derived(reorder.layout[reorder.layout.length - 1]);

    // Measuring changes heights — a panel rewraps when it changes column — so
    // one pass can reveal a better split than it started from. Three is enough
    // for that to settle in every arrangement here, and a hard stop means a
    // pathological one costs a few frames rather than the tab.
    const MAX_PASSES = 3;

    function rebalance(passesLeft = MAX_PASSES) {
        // One column below 860px: there's nothing to balance, and measuring
        // there would record heights that don't apply to the two-column case.
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
        // Re-measure once the new arrangement has been laid out, since the
        // heights that chose it were taken from the old one.
        if (passesLeft > 1) requestAnimationFrame(() => rebalance(passesLeft - 1));
    }

    // Deliberately not reading splitAt in a tracked context: rebalance writes
    // it, and an effect that read it would re-run itself for ever. The frame
    // callback runs outside the effect, so nothing it touches is a dependency.
    $effect(() => {
        void data;
        void reorder.layout;
        void edit.isResponsive;
        requestAnimationFrame(() => rebalance());
    });

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

    // A narrower window is a taller panel, so the split that was right at
    // 1400px often isn't at 900. Trailing-edge only: mid-drag of a window
    // border there's nothing worth measuring.
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

        // The upstream sync runs hourly, so there's nothing to gain from
        // polling hard — this is really just to catch a sync landing while
        // the tab is left open.
        stopPoll = createPoller(load, 1000 * 60 * 10, { jitterMs: 30_000 });
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
    {#if id === "lastRun"}
        <LastRun run={data.lastRun} />
    {:else if id === "volume"}
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
    {:else if id === "recovery"}
        <Recovery recovery={data.recovery} />
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
