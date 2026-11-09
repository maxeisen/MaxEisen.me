<!--
    Public cycling dashboard. The same page as /running (Activity/
    ActivityPage), without the race header, the plan, or the projected
    finish. Ride load is heart rate; power is shown only when a meter
    recorded it.
-->
<script>
    import ActivityPage from "../Activity/ActivityPage.svelte";
    import PageHeader from "../../lib/ui/PageHeader.svelte";
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

    const ORDER = [
        "lastRide", "recommendations", "volume", "fitness",
        "efficiency", "week", "load", "recovery", "intensity",
        "rides",
    ];

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

    function propsFor(id, data) {
        const today = data?.today?.date || null;
        switch (id) {
            case "lastRide": return { ride: data.lastRide, info: GLOSSARY.lastRide };
            case "recommendations": return { recommendations: data.recommendations, info: GLOSSARY.recommendations };
            case "volume": return {
                weeks: data.weeks,
                today,
                info: GLOSSARY.volume,
                distanceLabel: "Ride",
                chartLabel: "Weekly cycling volume in kilometres",
            };
            case "fitness": return { series: data.series, today, info: GLOSSARY.fitness };
            case "efficiency": return { efficiency: data.efficiency, today, info: GLOSSARY.efficiency };
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
</script>

<ActivityPage
    endpoint="/.netlify/functions/cyclingData"
    errorMessage="Couldn't load cycling data right now."
    order={ORDER}
    storageKey="cycling-layout-1"
    gridId="cycling-grid"
    panels={PANELS}
    {propsFor}
    title={() => "Cycling — Max Eisen"}
    description={() => "A ride log: fitness, fatigue, and the last ride. Not a race plan."}
    footnote="Synced from Strava. Ride load comes from heart rate; power is shown only when a power meter recorded it. No route maps here by design."
>
    {#snippet header()}
        <PageHeader kicker="Ride log" title="Cycling" />
    {/snippet}

    {#snippet today(data)}
        <Today today={data.today} inBlock={false} info={GLOSSARY.today} />
    {/snippet}
</ActivityPage>
