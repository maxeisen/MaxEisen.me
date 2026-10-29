<script>
    import Card from "../../Activity/Card.svelte";
    import RideDetails from "./RideDetails.svelte";
    import { daysAgo } from "../../Activity/lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { ride = null, info = GLOSSARY.lastRide } = $props();
</script>

<Card title="Last ride" {info}>
    {#snippet aside()}
        {#if ride}
            <span class="when">{daysAgo(ride.daysAgo)}</span>
        {/if}
    {/snippet}

    {#if !ride}
        <p class="card-empty">Nothing synced yet.</p>
    {:else}
        <RideDetails {ride} />
    {/if}
</Card>

<style>
    .when {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.7;
    }
</style>
