<!--
    The most recent run: what it was, the pace/HR trace, and what it moved.

    The card itself is just the "Last run" shell and the "how long ago" aside;
    the run's body lives in RunDetails, which the run-log modal reuses so the
    two read identically.
-->
<script>
    import Card from "../Card.svelte";
    import RunDetails from "./RunDetails.svelte";
    import { daysAgo } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { run = null } = $props();
</script>

<Card title="Last run" info={GLOSSARY.lastRun}>
    {#snippet aside()}
        {#if run}
            <span class="when">{daysAgo(run.daysAgo)}</span>
        {/if}
    {/snippet}

    {#if !run}
        <p class="card-empty">Nothing synced yet.</p>
    {:else}
        <RunDetails {run} />
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
