<!--
    Public marathon training dashboard.

    Everything is computed server-side by trainingData (which reads the synced
    Strava history out of Netlify Blobs and runs the deterministic metrics
    engine), so this component only fetches one payload and lays it out. No
    password gate: the page is public on purpose, and the payload carries no
    private activities and no GPS — see netlify/functions/_shared/training/
    shape.js for how that's enforced.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import BackLink from "../../lib/ui/BackLink.svelte";
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

    let data = $state(null);
    let error = $state("");
    let stopPoll;

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
        load();
        // The upstream sync runs hourly, so there's nothing to gain from
        // polling hard — this is really just to catch a sync landing while
        // the tab is left open.
        stopPoll = createPoller(load, 1000 * 60 * 10, { jitterMs: 30_000 });
    });

    onDestroy(() => {
        stopPoll?.();
        document.body.classList.remove("training-page");
    });
</script>

<svelte:head>
    <title>Road to Chicago — Max Eisen</title>
    <meta name="description" content="Live marathon training dashboard: weekly volume, fitness and fatigue, intensity balance, and where I'm projected to finish." />
</svelte:head>

<main class="training">
    <BackLink />

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

        <div class="grid">
            <div class="col-wide">
                <VolumeChart weeks={data.weeks} today={data.today} />
                <FitnessChart series={data.series} today={data.today} />
                <AerobicEfficiency efficiency={data.efficiency} summary={data.summary} today={data.today} />
                <Recommendations recommendations={data.recommendations} />
            </div>

            <div class="col-narrow">
                <RacePrediction summary={data.summary} />
                <LoadRisk acwr={data.summary?.acwr} riskWeek={data.summary?.riskWeek} />
                <IntensityMix intensity={data.summary?.intensity} />
                <WeekPlan {currentWeek} week={data.week} upcoming={data.upcoming} />
            </div>
        </div>

        <RunLog runs={data.runs} total={data.summary?.totals?.runs} />

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
    .col-wide, .col-narrow {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        min-width: 0;
    }

    @media (max-width: 1100px) {
        .training { padding-top: 3.5rem; }
    }
    @media (max-width: 860px) {
        .grid { grid-template-columns: minmax(0, 1fr); }
        .training { padding: 3.5rem var(--space-4) var(--space-7); }
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
