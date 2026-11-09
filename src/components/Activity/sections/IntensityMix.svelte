<!-- Easy / moderate / hard over the last four weeks. Target is ~80% easy. -->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import { formatDuration, pct } from "../lib/format.js";
    import { GLOSSARY } from "../../Training/lib/glossary.js";

    let {
        intensity = null,
        target = 80,
        info = GLOSSARY.intensity,
        emptyLabel = "No runs in the last four weeks.",
        timeLabel = "Share of running time by intensity band",
        hardNote = "Your easy days are too hard.",
    } = $props();

    const total = $derived(intensity?.totalSec || 0);
    const bands = $derived([
        { key: "easy", label: "Easy", seconds: intensity?.easySec || 0, share: intensity?.easyPct },
        { key: "moderate", label: "Moderate", seconds: intensity?.moderateSec || 0, share: intensity?.moderatePct },
        { key: "hard", label: "Hard", seconds: intensity?.hardSec || 0, share: intensity?.hardPct },
    ]);
    const easyShare = $derived(Number.isFinite(intensity?.easyPct) ? intensity.easyPct : null);
    const onTarget = $derived(easyShare !== null && easyShare >= target - 5);
</script>

<Card title="Intensity mix" {info}>
    {#snippet aside()}
        <span>Last 4 weeks</span>
    {/snippet}

    {#if total === 0}
        <p class="card-empty">{emptyLabel}</p>
    {:else}
        <div class="bar" role="img" aria-label="{timeLabel}: {bands.map((b) => `${b.label} ${pct(b.share)}`).join(', ')}">
            {#each bands as band}
                {#if band.seconds > 0}
                    {@const share = (band.seconds / total) * 100}
                    <div class="segment segment-{band.key}" style="flex-basis: {share}%" title="{band.label}: {pct(band.share)}, {formatDuration(band.seconds)}">
                        {#if share >= 14}<span>{pct(band.share)}</span>{/if}
                    </div>
                {/if}
            {/each}
            <div class="target-line" style="left: {target}%" title="{target}% easy target"></div>
        </div>

        <ul class="legend">
            {#each bands as band}
                <li>
                    <span class="dot dot-{band.key}"></span>
                    <span>{band.label}</span>
                    <strong>{pct(band.share)}</strong>
                    <span class="legend-time">{formatDuration(band.seconds)}</span>
                </li>
            {/each}
            <li class="legend-target"><span class="tick"></span>{target}% easy target</li>
        </ul>

        <p class="verdict" class:good={onTarget}>
            {#if easyShare === null}
                Not enough data to judge the balance.
            {:else if onTarget}
                {pct(easyShare)} easy — close enough to the {target}% target.
            {:else}
                {pct(easyShare)} easy, against a {target}% target. {hardNote}
            {/if}
        </p>
    {/if}
</Card>

<style>
    /* One whole split into parts: blocks separated by a 2px gap in the
       surface colour, each with its own corners, share printed inside. */
    .bar {
        position: relative;
        display: flex;
        gap: 2px;
        height: 28px;
    }
    .segment {
        display: flex;
        align-items: center;
        min-width: 3px;
        padding-left: var(--space-2);
        border-radius: 4px;
        overflow: hidden;
        font-size: var(--font-2xs);
        font-weight: var(--weight-semibold);
        color: #15130f;
    }
    .segment-easy { background: var(--tone-good); }
    .segment-moderate { background: var(--tone-warn); }
    .segment-hard { background: var(--tone-bad); }
    :global([data-theme="light"]) .segment { color: #ffffff; }
    /* A tick hanging under the bar, so it never covers a segment's label. */
    .target-line {
        position: absolute;
        top: calc(100% + 3px);
        height: 8px;
        width: 2px;
        margin-left: -1px;
        border-radius: 1px;
        background: var(--text-strong);
    }

    .legend {
        list-style: none;
        margin: var(--space-5) 0 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-4);
    }
    .legend li {
        display: flex;
        align-items: baseline;
        gap: 6px;
        font-size: var(--font-xs);
        color: var(--text-2);
    }
    .dot { width: 8px; height: 8px; border-radius: 2px; align-self: center; }
    .dot-easy { background: var(--tone-good); }
    .dot-moderate { background: var(--tone-warn); }
    .dot-hard { background: var(--tone-bad); }
    .legend strong { font-weight: var(--weight-semibold); color: var(--text-strong); }
    .legend-time { color: var(--text-3); }
    .legend-target { align-items: center !important; }
    .tick { width: 2px; height: 12px; border-radius: 1px; background: var(--text-strong); }

    .verdict {
        margin: var(--space-4) 0 0;
        font-size: var(--font-sm);
        color: var(--text);
    }
</style>
