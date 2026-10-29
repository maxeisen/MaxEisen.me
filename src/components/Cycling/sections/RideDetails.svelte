<!--
    One ride: the headline four, then power, heart rate and cadence, then
    what the day did to fitness. No splits, no pace, no map.
-->
<script>
    import { formatDistance, signed, speed, timeTaken } from "../../Activity/lib/format.js";

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
</script>

{#if ride}
    <a class="title" href="https://www.strava.com/activities/{ride.id}" target="_blank" rel="noreferrer">
        {ride.name}
    </a>

    {#if ride.effort}
        <p class="tags"><span class="tag effort-{ride.effort}">{ride.effort}</span></p>
    {/if}

    <div class="headline">
        <div class="stat">
            <strong>{formatDistance(ride.distanceM)}</strong>
            <span>distance</span>
        </div>
        <div class="stat">
            <strong>{timeTaken(ride.movingTimeSec)}</strong>
            <span>moving</span>
        </div>
        <div class="stat">
            <strong>{ride.elevationGainM > 0 ? `${Math.round(ride.elevationGainM)} m` : "—"}</strong>
            <span>climb</span>
        </div>
        <div class="stat">
            <strong>{speed(ride.distanceM, ride.movingTimeSec)}</strong>
            <span>average speed</span>
        </div>
    </div>

    {#if watts || beats || ride.averageCadence > 0}
        <div class="headline support">
            {#if watts}
                <div class="stat">
                    <strong>{watts.pair}</strong>
                    <span>{watts.pair.includes("/") ? "average/max power" : "average power"}</span>
                </div>
                {#if watts.weighted}
                    <div class="stat">
                        <strong>{watts.weighted}</strong>
                        <span>weighted power</span>
                    </div>
                {/if}
            {/if}
            {#if beats}
                <div class="stat">
                    <strong>{beats}</strong>
                    <span>{ride.maxHr > 0 ? "average/max hr" : "average hr"}</span>
                </div>
            {/if}
            {#if ride.averageCadence > 0}
                <div class="stat">
                    <strong>{Math.round(ride.averageCadence)}</strong>
                    <span>cadence rpm</span>
                </div>
            {/if}
        </div>
    {/if}

    {#if changes.length}
        <div class="impact">
            <h3>What it did</h3>
            <div class="changes">
                {#each changes as change (change.key)}
                    <div class="change" class:good={change.good}>
                        <span class="change-label">{change.label}</span>
                        <strong>{signed(change.delta)}</strong>
                        <span class="change-value">to {change.value.toFixed(1)}</span>
                    </div>
                {/each}
            </div>
            <p class="verdict">
                {#if ride.ridesThatDay > 1}
                    The day's change is shared across {ride.ridesThatDay} rides.
                {/if}
                {#if relativeSize}
                    {ride.effort ? `${ride.effort} ride, ` : ""}{relativeSize}.
                {/if}
            </p>
        </div>
    {/if}
{/if}

<style>
    .title {
        display: block;
        font-family: var(--font-sans);
        font-size: var(--font-lg);
        font-weight: 600;
        color: var(--header-colour);
        text-decoration: none;
        line-height: 1.2;
    }
    .title:hover { color: var(--main-green); }

    .tags {
        display: flex;
        gap: var(--space-2);
        margin: var(--space-2) 0 0;
        font-size: var(--font-2xs);
    }
    .tag {
        display: inline-block;
        padding: 1px 6px;
        border-radius: var(--radius-pill);
        background: var(--main-green-translucent);
        color: var(--main-green);
        font-weight: 600;
        letter-spacing: 0.04em;
    }
    .tag.effort-hard { background: var(--tone-bad-bg); color: var(--tone-bad); }
    .tag.effort-moderate { background: var(--tone-warn-bg); color: var(--tone-warn); }
    .tag.effort-easy { background: var(--tone-good-bg); color: var(--tone-good); }

    .headline {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
        gap: var(--space-3);
        margin-top: var(--space-4);
        padding: var(--space-3) var(--space-4);
        background: var(--item-background);
        border-radius: var(--radius-sm);
    }
    .support { margin-top: var(--space-2); }
    .stat { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .stat strong {
        font-family: var(--font-sans);
        font-size: var(--font-md);
        font-weight: 700;
        color: var(--header-colour);
        line-height: 1.1;
    }
    .stat span {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--paragraph-colour);
        opacity: 0.65;
    }

    .impact { margin-top: var(--space-5); }
    .impact h3 {
        margin: 0 0 var(--space-2);
        font-size: var(--font-2xs);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--paragraph-colour);
    }
    .changes {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-3);
    }
    .change { display: flex; flex-direction: column; gap: 2px; }
    .change strong { font-family: var(--font-sans); color: var(--header-colour); }
    .change.good strong { color: var(--tone-good); }
    .change-label, .change-value {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--paragraph-colour);
        opacity: 0.65;
    }
    .verdict {
        margin: var(--space-3) 0 0;
        font-size: var(--font-xs);
        line-height: 1.5;
        color: var(--paragraph-colour);
    }
</style>
