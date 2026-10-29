<!--
    Public cycling dashboard. Same rearrangeable layout as /running, without
    the race header, the plan, or the projected finish. Ride load is heart
    rate; power is shown only when a meter recorded it.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import ModalProvider from "../../lib/ui/ModalProvider.svelte";
    import BackLink from "../../lib/ui/BackLink.svelte";
    import EditToggle from "../../lib/ui/EditToggle.svelte";
    import { createRearrangeable } from "../../lib/ui/editMode.svelte.js";
    import Spinner from "../../lib/ui/Spinner.svelte";
    import { fetchJsonSwr } from "../../lib/data/swrCache.js";
    import { createPoller } from "../../lib/data/poller.js";
    import { bestSplit, worthMoving } from "../Training/lib/balance.js";
    import { STRAVA_PROFILE_URL } from "../../lib/strava.js";
    import Today from "../Activity/sections/Today.svelte";
    import Recommendations from "../Activity/sections/Recommendations.svelte";
    import VolumeChart from "../Activity/sections/VolumeChart.svelte";
    import FitnessChart from "../Activity/sections/FitnessChart.svelte";
    import LoadRisk from "../Activity/sections/LoadRisk.svelte";
    import IntensityMix from "../Activity/sections/IntensityMix.svelte";
    import Recovery from "../Activity/sections/Recovery.svelte";
    import LastRide from "./sections/LastRide.svelte";
    import Efficiency from "./sections/Efficiency.svelte";
    import ThisWeek from "./sections/ThisWeek.svelte";
    import RideLog from "./sections/RideLog.svelte";
    import { GLOSSARY } from "./lib/glossary.js";

    const ENDPOINT = "/.netlify/functions/cyclingData";
    const DEFAULT_ORDER = [
        "lastRide", "recommendations", "volume", "fitness",
        "efficiency", "week", "load", "recovery", "intensity",
        "rides",
    ];
    const INITIAL_SPLIT = 4;
    const LAYOUT_KEY = "cycling-layout-1";

    let data = $state(null);
    let error = $state("");
    let stopPoll;

    const { reorder, edit } = createRearrangeable({
        gridId: "cycling-grid",
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
        lastRide: LastRide,
        recommendations: Recommendations,
        volume: VolumeChart,
        fitness: FitnessChart,
        efficiency: Efficiency,
        week: ThisWeek,
        load: LoadRisk,
        recovery: Recovery,
        intensity: IntensityMix,
        rides: RideLog,
    };

    function propsFor(id) {
        switch (id) {
            case "lastRide": return { ride: data.lastRide, info: GLOSSARY.lastRide };
            case "recommendations": return { recommendations: data.recommendations, info: GLOSSARY.recommendations };
            case "volume": return {
                weeks: data.weeks,
                today: todayKey,
                info: GLOSSARY.volume,
                distanceLabel: "Ride",
                chartLabel: "Weekly cycling volume in kilometres",
            };
            case "fitness": return { series: data.series, today: todayKey, info: GLOSSARY.fitness };
            case "efficiency": return { efficiency: data.efficiency, today: todayKey, info: GLOSSARY.efficiency };
            case "week": return { week: data.week, info: GLOSSARY.week };
            case "load": return {
                acwr: data.summary?.acwr,
                riskWeek: data.summary?.riskWeek,
                info: GLOSSARY.load,
                shareLabel: "Long ride share",
            };
            case "recovery": return { recovery: data.recovery, info: GLOSSARY.recovery };
            case "intensity": return {
                intensity: data.summary?.intensity,
                info: GLOSSARY.intensity,
                emptyLabel: "No rides in the last four weeks.",
                timeLabel: "Share of riding time by intensity band",
                hardNote: "Your easy rides aren't easy enough.",
            };
            case "rides": return { activities: data.activities };
            default: return {};
        }
    }

    const MAX_PASSES = 3;

    function rebalance(passesLeft = MAX_PASSES) {
        if (edit.isResponsive) return;
        const grid = document.getElementById("cycling-grid");
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
            if (!data) error = "Couldn't load cycling data right now.";
            console.error("cyclingData load failed", err);
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
    <title>Cycling — Max Eisen</title>
    <meta name="description" content="A ride log: fitness, fatigue, and the last ride. Not a race plan." />
</svelte:head>

{#snippet panelSlot(id, idx)}
    <div class="slot" class:drop-target={reorder.dropTargetIdx === idx} data-slot-index={idx}>
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

<ModalProvider>
<main class="cycling">
    <BackLink />

    {#if data && edit.isResponsive}
        <EditToggle editing={edit.isEditing} onclick={edit.toggle} />
    {/if}

    {#if error && !data}
        <div class="state"><p>{error}</p></div>
    {:else if !data}
        <div class="state"><Spinner size={38} stroke={3} /></div>
    {:else}
        <header class="page-head">
            <h1>Cycling</h1>
            <p>Fitness and fatigue from rides. Not a race plan.</p>
        </header>

        <div class="today-strip">
            <Today today={data.today} inBlock={false} info={GLOSSARY.today} />
        </div>

        <div class="grid drag-grid" class:is-editing={edit.isEditing} class:is-dragging={reorder.isDragging} id="cycling-grid">
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
                Synced from Strava. Ride load comes from heart rate. Power is shown only when a
                power meter recorded it. No route maps here by design.
            </p>
            <p class="links">
                <a href={STRAVA_PROFILE_URL} target="_blank" rel="noreferrer">Strava profile ↗</a>
            </p>
        </footer>
    {/if}
</main>
</ModalProvider>

<style>
    .cycling {
        max-width: 1180px;
        margin: 0 auto;
        padding: var(--space-7) var(--space-5) var(--space-8);
    }
    .page-head { margin: 0 0 var(--space-5); }
    .page-head h1 {
        margin: 0;
        font-family: var(--font-sans);
        font-size: clamp(2rem, 4vw, 2.8rem);
        letter-spacing: -0.03em;
        color: var(--header-colour);
    }
    .page-head p {
        margin: var(--space-2) 0 0;
        color: var(--paragraph-colour);
        opacity: 0.75;
    }
    .state {
        min-height: 60vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--paragraph-colour);
    }
    .today-strip { margin-bottom: var(--space-4); min-width: 0; }
    .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
        gap: var(--space-4);
        align-items: start;
        margin-bottom: var(--space-4);
    }
    .col { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
    .col-full { grid-column: 1 / -1; }
    .slot { min-width: 0; --drop-outline-offset: 3px; --drop-outline-radius: var(--radius-xl); }
    .panel { position: relative; min-width: 0; }
    .panel.dragging { z-index: 20; filter: drop-shadow(0 12px 22px rgba(0, 0, 0, 0.35)); }
    .grid.is-editing .col:nth-child(even) .panel:not(.dragging) {
        animation-name: edit-jiggle-b;
        animation-duration: 0.46s;
        animation-delay: -0.18s;
    }
    @media (max-width: 1100px) { .cycling { padding-top: 3.5rem; } }
    @media (max-width: 860px) {
        .grid { grid-template-columns: minmax(0, 1fr); }
        .cycling { padding: 3.5rem var(--space-4) var(--space-7); }
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
    }
    .links { margin-top: var(--space-3); }
    .links a { color: var(--main-green); text-decoration: none; font-weight: 600; }
</style>
