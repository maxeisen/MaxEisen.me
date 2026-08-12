<!--
    Public marathon training dashboard.

    Everything is computed server-side by trainingData (which reads the synced
    Strava history out of Netlify Blobs and runs the deterministic metrics
    engine), so this component only fetches one payload and lays it out. No
    password gate: the page is public on purpose, and the payload carries no
    private activities and no GPS — see netlify/functions/_shared/training/
    shape.js for how that's enforced.

    Panels are rearrangeable, using the same slot model as /dashboard (see
    lib/ui/reorder). Unlike the dashboard, dragging is always behind an edit
    toggle: these panels are full of links, scrollable lists and buttons, and
    a page where pressing a run and moving the mouse drags the panel instead
    of selecting text would be worse than one with an extra button.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import BackLink from "../../lib/ui/BackLink.svelte";
    import { createReorder } from "../../lib/ui/reorder.svelte.js";
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
    const PANELS = {
        volume: "Weekly volume",
        fitness: "Fitness and fatigue",
        efficiency: "Aerobic efficiency",
        recommendations: "What to do about it",
        prediction: "Race projection",
        load: "Injury risk",
        intensity: "Intensity mix",
        week: "This week",
        runs: "Runs this block",
    };
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
    let isEditing = $state(false);
    let stopPoll;
    let clickCapture;

    const reorder = createReorder({
        order: DEFAULT_ORDER,
        storageKey: LAYOUT_KEY,
        enabled: () => isEditing,
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

    // Arrow keys on a panel's handle move it a slot at a time, so the layout
    // is reachable without a pointer.
    function nudge(id, event) {
        const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
        if (!step) return;
        const target = reorder.layout.indexOf(id) + step;
        if (target < 0 || target >= DEFAULT_ORDER.length) return;
        event.preventDefault();
        reorder.move(id, target);
        // The handle moves with the panel; keep focus on it for repeat presses.
        const handle = event.currentTarget;
        requestAnimationFrame(() => handle.focus());
    }

    onMount(() => {
        document.body.classList.add("training-page");
        reorder.restore();
        load();

        // Capture phase, so it beats anchor navigation: while rearranging, a
        // tap is aimed at the panel rather than at whatever is inside it.
        clickCapture = (e) => {
            if (!e.target.closest("#training-grid")) return;
            if (e.target.closest(".panel-handle")) return;
            if (reorder.suppressesClick() || isEditing) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        document.addEventListener("click", clickCapture, true);
        // The upstream sync runs hourly, so there's nothing to gain from
        // polling hard — this is really just to catch a sync landing while
        // the tab is left open.
        stopPoll = createPoller(load, 1000 * 60 * 10, { jitterMs: 30_000 });
    });

    onDestroy(() => {
        stopPoll?.();
        document.removeEventListener("click", clickCapture, true);
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
            class="panel"
            class:dragging={reorder.draggingId === id}
            data-panel={id}
            style:transform={reorder.transformFor(id)}
            onpointerdown={(e) => { if (e.pointerType !== "touch") reorder.start(id, e); }}
        >
            {#if isEditing}
                <button
                    class="panel-handle"
                    type="button"
                    aria-label="Move {PANELS[id]} — use the arrow keys, or drag"
                    title="Drag to rearrange"
                    onpointerdown={(e) => { e.stopPropagation(); reorder.start(id, e); }}
                    onkeydown={(e) => nudge(id, e)}
                >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                        <circle cx="5.5" cy="4" r="1.35" /><circle cx="10.5" cy="4" r="1.35" />
                        <circle cx="5.5" cy="8" r="1.35" /><circle cx="10.5" cy="8" r="1.35" />
                        <circle cx="5.5" cy="12" r="1.35" /><circle cx="10.5" cy="12" r="1.35" />
                    </svg>
                </button>
            {/if}
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

    {#if data}
        <div class="edit-bar">
            {#if isEditing}
                <button class="edit-btn ghost" type="button" onclick={() => reorder.reset()}>
                    Reset
                </button>
            {/if}
            <button
                class="edit-btn"
                class:active={isEditing}
                type="button"
                aria-pressed={isEditing ? "true" : "false"}
                onclick={() => (isEditing = !isEditing)}
            >
                {isEditing ? "Done" : "Rearrange"}
            </button>
        </div>
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
            class="grid"
            class:is-editing={isEditing}
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

    .slot { min-width: 0; }
    .panel { position: relative; min-width: 0; }
    .panel.dragging {
        /* pointer-events off so elementFromPoint finds the slot underneath. */
        pointer-events: none;
        z-index: 20;
        opacity: 0.92;
        cursor: grabbing;
        /* The card surfaces are translucent, so a panel in flight would
           otherwise read as part of whatever it's passing over. */
        filter: drop-shadow(0 12px 22px rgba(0, 0, 0, 0.35));
    }
    /* A finger dragging the panel body would have to give up scrolling
       (touch-action: none) to do it, and on a phone the panels are most of
       the page — you'd be stuck at whichever one you started on. So touch
       drags from the handle only; a mouse can still grab anywhere. */
    .grid.is-editing .panel {
        cursor: grab;
        user-select: none;
    }
    .grid.is-editing .slot.drop-target {
        outline: 2px dashed var(--main-green);
        outline-offset: 3px;
        border-radius: var(--radius-xl);
    }

    /* Corner badge rather than an inline control: every panel already has an
       info button in its top-right, and overhanging the border keeps the two
       from reading as the same row of buttons. */
    .panel-handle {
        position: absolute;
        top: -9px;
        right: -9px;
        z-index: 21;
        width: 26px;
        height: 26px;
        display: grid;
        place-items: center;
        padding: 0;
        border: 1px solid var(--main-green-translucent);
        border-radius: 50%;
        background: var(--background-one);
        color: var(--main-green);
        cursor: grab;
        touch-action: none;
        box-shadow: var(--inner-box-shadow);
    }
    .panel-handle svg { width: 15px; height: 15px; display: block; fill: currentColor; }
    @media (pointer: coarse) {
        .panel-handle { width: 34px; height: 34px; top: -12px; right: -12px; }
        .panel-handle svg { width: 18px; height: 18px; }
    }

    /* iOS-style jiggle, matching /dashboard's edit mode. */
    @keyframes panel-jiggle {
        0% { transform: rotate(-0.35deg); }
        50% { transform: rotate(0.35deg) translateY(-1px); }
        100% { transform: rotate(-0.35deg); }
    }
    .grid.is-editing .panel { animation: panel-jiggle 0.5s ease-in-out infinite; }
    .grid.is-editing .col:nth-child(even) .panel { animation-delay: -0.2s; animation-duration: 0.54s; }
    .grid.is-editing .panel.dragging { animation: none; }
    @media (prefers-reduced-motion: reduce) {
        .grid.is-editing .panel,
        .grid.is-editing .col:nth-child(even) .panel { animation: none; }
    }

    .edit-bar {
        position: fixed;
        top: 0.9rem;
        right: 1rem;
        z-index: 60;
        display: flex;
        gap: var(--space-2);
    }
    .edit-btn {
        padding: 0.4rem 0.85rem;
        border: 1px solid var(--main-green-translucent);
        border-radius: var(--radius-pill);
        background: var(--inner-background);
        color: var(--main-green);
        font-family: inherit;
        font-size: var(--font-xs);
        font-weight: 600;
        cursor: pointer;
        opacity: 0.85;
        backdrop-filter: blur(var(--blur-md));
        -webkit-backdrop-filter: blur(var(--blur-md));
        transition: background 0.2s ease, color 0.2s ease, opacity 0.2s ease;
    }
    .edit-btn:hover { opacity: 1; }
    .edit-btn.active {
        background: var(--main-green);
        border-color: var(--main-green);
        color: var(--background-one);
        opacity: 1;
    }
    .edit-btn.ghost { opacity: 0.6; }

    @media (max-width: 1100px) {
        .training { padding-top: 3.5rem; }
    }
    @media (max-width: 860px) {
        .grid { grid-template-columns: minmax(0, 1fr); }
        .training { padding: 3.5rem var(--space-4) var(--space-7); }
        .edit-bar { top: 0.75rem; right: 0.75rem; }
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
