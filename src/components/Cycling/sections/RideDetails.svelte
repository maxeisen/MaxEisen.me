<!--
    One ride: the headline four, then power, heart rate and cadence, then
    heart rate and meter watts along the distance, then what the day did
    to fitness. No splits, no pace, no map.
-->
<script>
    import ActivityHead from "../../Activity/sections/ActivityHead.svelte";
    import WhatItDid from "../../Activity/sections/WhatItDid.svelte";
    import Stat from "../../../lib/ui/Stat.svelte";
    import StatGrid from "../../../lib/ui/StatGrid.svelte";
    import Tag from "../../../lib/ui/Tag.svelte";
    import LastRideChart from "../charts/LastRideChart.svelte";
    import { formatDistance, speed, timeTaken } from "../../Activity/lib/format.js";

    let { ride = null } = $props();

    const beats = $derived.by(() => {
        if (!(ride?.averageHr > 0)) return null;
        const avg = Math.round(ride.averageHr);
        return ride.maxHr > 0 ? `${avg}/${Math.round(ride.maxHr)}` : String(avg);
    });

    const watts = $derived.by(() => {
        if (ride?.deviceWatts !== true || !(ride.averageWatts > 0)) return null;
        const avg = Math.round(ride.averageWatts);
        const max = ride.maxWatts > 0 ? Math.round(ride.maxWatts) : null;
        return {
            pair: max ? `${avg}/${max}` : String(avg),
            weighted: ride.weightedAverageWatts > 0 ? Math.round(ride.weightedAverageWatts) : null,
        };
    });

    const form = $derived(ride?.impact?.form || null);
    const load = $derived(ride?.impact?.load || null);

    const changes = $derived(
        form
            ? [
                    { key: "fitness", label: "Fitness", value: form.ctl, delta: form.ctlDelta, good: form.ctlDelta > 0 },
                    { key: "fatigue", label: "Fatigue", value: form.atl, delta: form.atlDelta, good: form.atlDelta < 0 },
                    { key: "form", label: "Form", value: form.tsb, delta: form.tsbDelta, good: form.tsbDelta > 0 },
                ]
            : [],
    );

    const relativeSize = $derived.by(() => {
        if (!(load?.vsTypicalPct > 0) || !(load.ridesCompared >= 3)) return null;
        const ratio = load.vsTypicalPct;
        if (ratio >= 140) return "much bigger than your recent rides";
        if (ratio >= 110) return "bigger than your recent rides";
        if (ratio > 90) return "about the size of your recent rides";
        if (ratio > 60) return "smaller than your recent rides";
        return "much smaller than your recent rides";
    });

    const EFFORT_TONE = { hard: "bad", moderate: "warn", easy: "good" };
</script>

{#if ride}
    <ActivityHead id={ride.id} name={ride.name}>
        {#snippet tags()}
            {#if ride.effort}<Tag tone={EFFORT_TONE[ride.effort] || "neutral"}>{ride.effort}</Tag>{/if}
        {/snippet}
    </ActivityHead>

    <div class="headline">
        <StatGrid rule={watts || beats || ride.averageCadence > 0 ? "top" : "both"} min={96}>
            <Stat size="lg" label="Distance" value={formatDistance(ride.distanceM)} />
            <Stat size="lg" label="Moving" value={timeTaken(ride.movingTimeSec)} />
            <Stat size="lg" label="Climb" value={ride.elevationGainM > 0 ? `${Math.round(ride.elevationGainM)} m` : "—"} />
            <Stat size="lg" label="Average speed" value={speed(ride.distanceM, ride.movingTimeSec)} />
        </StatGrid>
        {#if watts || beats || ride.averageCadence > 0}
            <div class="support">
                <StatGrid rule="both" min={96}>
                    {#if watts}
                        <Stat label={watts.pair.includes("/") ? "Average / max power" : "Average power"} value={watts.pair} />
                        {#if watts.weighted}<Stat label="Weighted power" value={watts.weighted} />{/if}
                    {/if}
                    {#if beats}<Stat label={ride.maxHr > 0 ? "Average / max HR" : "Average HR"} value={beats} />{/if}
                    {#if ride.averageCadence > 0}<Stat label="Cadence" value="{Math.round(ride.averageCadence)} rpm" />{/if}
                </StatGrid>
            </div>
        {/if}
    </div>

    <LastRideChart {ride} />

    <WhatItDid {changes}>
        {#if ride.ridesThatDay > 1}
            The day's change is shared across {ride.ridesThatDay} rides.
        {/if}
        {#if relativeSize}
            {ride.effort ? `${ride.effort[0].toUpperCase()}${ride.effort.slice(1)} ride, ` : ""}{relativeSize}.
        {/if}
    </WhatItDid>
{/if}

<style>
    .headline { margin-top: var(--space-4); }
    /* Same gap either side of the rule between the two rows. */
    .support { margin-top: var(--space-4); }
</style>
