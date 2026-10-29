<script>
    import Card from "../../Activity/Card.svelte";
    import { formatDistance, timeTaken, weekRange } from "../../Activity/lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { week = null, info = GLOSSARY.week } = $props();
</script>

<Card title="This week" {info}>
    {#if !week || !(week.rides?.length)}
        <p class="card-empty">No rides yet this week.</p>
    {:else}
        <p class="totals">
            <strong>{week.actualKm.toFixed(1)} km</strong>
            <span>{timeTaken(week.movingTimeSec)}</span>
            {#if week.start}<span class="range">{weekRange(week.start)}</span>{/if}
        </p>
        <ul>
            {#each week.rides as ride (ride.id)}
                <li>
                    <span class="name">{ride.name}</span>
                    <span class="meta">{formatDistance(ride.distanceM)} · {timeTaken(ride.movingTimeSec)}</span>
                </li>
            {/each}
        </ul>
    {/if}
</Card>

<style>
    .totals {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3);
        align-items: baseline;
        margin: 0 0 var(--space-3);
    }
    .totals strong {
        font-family: var(--font-sans);
        font-size: var(--font-md);
        color: var(--header-colour);
    }
    .totals span, .meta {
        font-size: var(--font-xs);
        color: var(--paragraph-colour);
        opacity: 0.75;
    }
    .range { text-transform: uppercase; letter-spacing: 0.08em; font-size: var(--font-2xs); }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
    li {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
        font-size: var(--font-sm);
    }
    .name { color: var(--header-colour); font-weight: 600; }
</style>
