<!--
    Easy / moderate / hard distribution over the last four weeks.

    The target is roughly 80% easy. The band worth watching is the moderate
    middle: time there is the classic way to accumulate fatigue without the
    adaptation that either genuinely easy or genuinely hard running gives.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import { formatDuration, pct } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { intensity = null, target = 80 } = $props();

    const total = $derived(intensity?.totalSec || 0);
    const bands = $derived([
        { key: "easy", label: "Easy", seconds: intensity?.easySec || 0, share: intensity?.easyPct },
        { key: "moderate", label: "Moderate", seconds: intensity?.moderateSec || 0, share: intensity?.moderatePct },
        { key: "hard", label: "Hard", seconds: intensity?.hardSec || 0, share: intensity?.hardPct },
    ]);
    const easyShare = $derived(Number.isFinite(intensity?.easyPct) ? intensity.easyPct : null);
    const onTarget = $derived(easyShare !== null && easyShare >= target - 5);
</script>

<Card title="Intensity mix" info={GLOSSARY.intensity}>
    {#snippet aside()}
        <span class="window">last 4 weeks</span>
    {/snippet}

    {#if total === 0}
        <p class="empty">No runs in the last four weeks.</p>
    {:else}
        <div class="bar" role="img" aria-label="Share of running time by intensity band">
            {#each bands as band}
                {#if band.seconds > 0}
                    <div
                        class="segment segment-{band.key}"
                        style="width: {(band.seconds / total) * 100}%"
                        title="{band.label}: {formatDuration(band.seconds)}"
                    ></div>
                {/if}
            {/each}
            <div class="target-line" style="left: {target}%" title="{target}% easy target"></div>
        </div>

        <ul class="legend">
            {#each bands as band}
                <li>
                    <span class="dot dot-{band.key}"></span>
                    <span class="legend-label">{band.label}</span>
                    <strong>{pct(band.share)}</strong>
                    <span class="legend-time">{formatDuration(band.seconds)}</span>
                </li>
            {/each}
        </ul>

        <p class="verdict" class:good={onTarget}>
            {#if easyShare === null}
                Not enough data to judge the balance.
            {:else if onTarget}
                {pct(easyShare)} easy — close enough to the {target}% target.
            {:else}
                {pct(easyShare)} easy, against a {target}% target. Your easy days are running too hard.
            {/if}
        </p>
    {/if}
</Card>

<style>
    .window {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.6;
    }

    .bar {
        position: relative;
        display: flex;
        height: 28px;
        border-radius: var(--radius-sm);
        overflow: hidden;
        background: var(--item-background);
    }
    .segment { height: 100%; }
    .segment-easy { background: var(--tone-good); }
    .segment-moderate { background: var(--tone-warn); }
    .segment-hard { background: var(--tone-bad); }
    .target-line {
        position: absolute;
        top: -3px;
        bottom: -3px;
        width: 2px;
        background: var(--header-colour);
        opacity: 0.75;
    }

    .legend {
        list-style: none;
        margin: var(--space-4) 0 0 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-4);
    }
    .legend li {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        font-size: var(--font-xs);
        color: var(--paragraph-colour);
    }
    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        align-self: center;
    }
    .dot-easy { background: var(--tone-good); }
    .dot-moderate { background: var(--tone-warn); }
    .dot-hard { background: var(--tone-bad); }
    .legend-label { opacity: 0.75; }
    .legend strong {
        font-family: var(--font-serif);
        color: var(--header-colour);
    }
    .legend-time { opacity: 0.55; }

    .verdict {
        font-size: var(--font-sm);
        color: var(--paragraph-colour);
        opacity: 0.85;
        margin: var(--space-4) 0 0 0;
    }
    .verdict.good { color: var(--tone-good); opacity: 1; }
    .empty {
        font-size: var(--font-sm);
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin: 0;
    }
</style>
