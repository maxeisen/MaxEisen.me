<!--
    Public running dashboard. While a race is still ahead it is that block —
    countdown, goal, week plan. Afterwards the same page just tracks fitness.

    trainingData computes everything server-side (Strava history in Netlify
    Blobs → deterministic metrics). No password gate: the page is public, and
    shape.js drops private activities and GPS before anything is stored.

    The shell (fetch, grid, drag, footer) is Activity/ActivityPage, shared
    with /cycling; this file is the running-specific configuration.
-->
<script>
    import ActivityPage from "../Activity/ActivityPage.svelte";
    import { readTrainingBootstrap } from "./lib/bootstrap.js";
    import { inBlock, trainingPageMeta } from "./lib/block.js";
    import RaceHeader from "./sections/RaceHeader.svelte";
    import SyncNotice from "./sections/SyncNotice.svelte";
    import Today from "../Activity/sections/Today.svelte";
    import LastRun from "./sections/LastRun.svelte";
    import Recommendations from "../Activity/sections/Recommendations.svelte";
    import VolumeChart from "../Activity/sections/VolumeChart.svelte";
    import FitnessChart from "../Activity/sections/FitnessChart.svelte";
    import AerobicEfficiency from "./sections/AerobicEfficiency.svelte";
    import LoadRisk from "../Activity/sections/LoadRisk.svelte";
    import IntensityMix from "../Activity/sections/IntensityMix.svelte";
    import RacePrediction from "./sections/RacePrediction.svelte";
    import WeekPlan from "./sections/WeekPlan.svelte";
    import Recovery from "../Activity/sections/Recovery.svelte";
    import RunLog from "./sections/RunLog.svelte";

    // Authored reading order; the last panel spans both columns. Bump the
    // storage key when this changes so a saved layout can't pin the old
    // imbalance or silently drop a new panel.
    const ORDER = [
        "lastRun", "recommendations", "volume", "fitness",
        "efficiency", "prediction", "week", "load", "recovery", "intensity",
        "runs",
    ];

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

    function propsFor(id, data) {
        const today = data?.today?.date || null;
        switch (id) {
            case "lastRun": return { run: data.lastRun };
            case "volume": return { weeks: data.weeks, today };
            case "fitness": return { series: data.series, today };
            case "efficiency": return { efficiency: data.efficiency, summary: data.summary, today };
            case "recommendations": return { recommendations: data.recommendations };
            case "prediction": return { summary: data.summary };
            case "load": return { acwr: data.summary?.acwr, riskWeek: data.summary?.riskWeek };
            case "intensity": return { intensity: data.summary?.intensity };
            case "week": return { week: data.week, upcoming: data.upcoming, inBlock: inBlock(data.summary) };
            case "recovery": return { recovery: data.recovery };
            case "runs": return { runs: data.runs, total: data.summary?.totals?.runs };
            default: return {};
        }
    }
</script>

<ActivityPage
    endpoint="/.netlify/functions/trainingData"
    seed={readTrainingBootstrap}
    errorMessage="Couldn't load running data right now."
    order={ORDER}
    storageKey="training-layout-4"
    gridId="training-grid"
    panels={PANELS}
    {propsFor}
    title={(data) => trainingPageMeta(data?.summary).title}
    description={(data) => trainingPageMeta(data?.summary).desc}
    footnote="Synced from Strava. Metrics are computed deterministically — training load from heart-rate reserve, pace adjusted for gradient — and every recommendation shows the number that triggered it. No route maps here by design."
>
    {#snippet header(data)}
        <RaceHeader summary={data.summary} />
        <SyncNotice sync={data.sync} runCount={data.runs?.length ?? 0} />
    {/snippet}

    {#snippet today(data)}
        <Today today={data.today} inBlock={inBlock(data.summary)} />
    {/snippet}
</ActivityPage>
