<!--
    Ranked training recommendations.

    Every card shows the number that triggered it next to the threshold it
    crossed. That's the point of the deterministic rule engine: advice you can
    argue with, rather than advice you have to trust.
-->
<script>
    let { recommendations = [] } = $props();

    const SEVERITY_LABEL = {
        critical: "Act now",
        warning: "Watch",
        info: "Note",
        good: "On track",
    };

    function readout(rec) {
        if (!Number.isFinite(rec.metric)) return null;
        const value = Math.abs(rec.metric) < 10 ? rec.metric.toFixed(2) : Math.round(rec.metric);
        if (!Number.isFinite(rec.threshold)) return `${value}`;
        const limit = Math.abs(rec.threshold) < 10 ? rec.threshold.toFixed(2) : Math.round(rec.threshold);
        return `${value} vs ${limit}`;
    }
</script>

<section class="card recs">
    <h2>What to do about it</h2>

    {#if recommendations.length === 0}
        <p class="empty">Not enough training data yet to say anything useful.</p>
    {:else}
        <ul>
            {#each recommendations as rec (rec.id)}
                <li class="rec rec-{rec.severity}">
                    <div class="rec-head">
                        <span class="rec-badge">{SEVERITY_LABEL[rec.severity] || rec.severity}</span>
                        {#if readout(rec)}
                            <span class="rec-metric" title="Measured value against its threshold">{readout(rec)}</span>
                        {/if}
                    </div>
                    <h3>{rec.title}</h3>
                    <p>{rec.detail}</p>
                </li>
            {/each}
        </ul>
    {/if}
</section>

<style>
    .recs h2 {
        font-family: var(--font-serif);
        font-size: var(--font-lg);
        font-weight: 600;
        color: var(--header-colour);
        margin: 0 0 var(--space-4) 0;
    }
    .empty {
        font-size: var(--font-sm);
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin: 0;
    }
    ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
    }
    .rec {
        padding: var(--space-4);
        border-radius: var(--radius-md);
        background: var(--item-background);
        border-left: 3px solid var(--main-green);
    }
    .rec-critical { border-left-color: var(--color-error); }
    .rec-warning { border-left-color: #d9b777; }
    .rec-info { border-left-color: var(--main-green); }
    .rec-good { border-left-color: var(--main-green); opacity: 0.85; }

    .rec-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-2);
    }
    .rec-badge {
        font-size: var(--font-2xs);
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--main-green);
    }
    .rec-critical .rec-badge { color: var(--color-error-soft); }
    .rec-warning .rec-badge { color: #e0c288; }

    .rec-metric {
        font-family: var(--font-serif);
        font-size: var(--font-xs);
        color: var(--paragraph-colour);
        opacity: 0.65;
        white-space: nowrap;
    }
    h3 {
        font-family: var(--font-serif);
        font-size: var(--font-md);
        font-weight: 600;
        color: var(--header-colour);
        margin: 0 0 var(--space-2) 0;
        letter-spacing: -0.01em;
    }
    p {
        font-size: var(--font-sm);
        line-height: 1.55;
        color: var(--paragraph-colour);
        opacity: 0.88;
        margin: 0;
    }
</style>
