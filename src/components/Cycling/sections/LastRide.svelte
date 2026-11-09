<script>
    import Card from "../../../lib/ui/Card.svelte";
    import RideDetails from "./RideDetails.svelte";
    import { daysAgo } from "../../Activity/lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { ride = null, info = GLOSSARY.lastRide } = $props();
</script>

<Card title="Last ride" {info}>
    {#snippet aside()}
        {#if ride}
            <span>{daysAgo(ride.daysAgo)}</span>
        {/if}
    {/snippet}

    {#if !ride}
        <p class="card-empty">Nothing synced yet.</p>
    {:else}
        <RideDetails {ride} />
    {/if}
</Card>
