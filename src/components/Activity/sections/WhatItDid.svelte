<!--
    "What it did": how one activity moved fitness, fatigue and form, plus a
    sentence about it (children). Shared by the run and ride details.

    Props
      changes  [{ key, label, value, delta, good }]
-->
<script>
    import Stat from "../../../lib/ui/Stat.svelte";
    import StatGrid from "../../../lib/ui/StatGrid.svelte";
    import { signed } from "../lib/format.js";

    let { changes = [], children } = $props();
</script>

{#if changes.length}
    <div class="impact">
        <h3 class="kicker">What it did</h3>
        <StatGrid columns={3}>
            {#each changes as change (change.key)}
                <Stat
                    label={change.label}
                    value={signed(change.delta)}
                    note={`to ${change.value.toFixed(1)}`}
                    tone={change.good ? "good" : null}
                />
            {/each}
        </StatGrid>
        {#if children}
            <p class="verdict">{@render children()}</p>
        {/if}
    </div>
{/if}

<style>
    .impact {
        margin-top: var(--space-5);
        padding-top: var(--space-4);
        border-top: 1px solid var(--border);
    }
    h3 { margin: 0 0 var(--space-3); }
    .verdict {
        margin: var(--space-3) 0 0;
        font-size: var(--font-sm);
        line-height: 1.5;
        color: var(--text);
    }
    .verdict:empty { display: none; }
</style>
