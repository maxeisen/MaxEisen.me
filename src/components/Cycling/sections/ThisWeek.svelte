<script>
    import Card from "../../../lib/ui/Card.svelte";
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
        gap: var(--space-1) var(--space-3);
        align-items: baseline;
        margin: 0 0 var(--space-3);
    }
    .totals strong {
        font-size: var(--font-lg);
        font-weight: var(--weight-semibold);
        color: var(--text-strong);
    }
    .totals span, .meta { font-size: var(--font-xs); color: var(--text-2); }
    .range { margin-left: auto; color: var(--text-3) !important; }
    ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); }
    li {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-2) 0;
        border-bottom: 1px solid var(--border);
        font-size: var(--font-sm);
    }
    .name { color: var(--text-strong); font-weight: var(--weight-medium); }
    .meta { font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
