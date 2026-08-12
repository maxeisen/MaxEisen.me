<!--
    Ranked training recommendations.

    Every card shows the number that triggered it next to the threshold it
    crossed. That's the point of the deterministic rule engine: advice you can
    argue with, rather than advice you have to trust.

    Severity has to survive a glance. Four levels separated only by the shade of
    a 3px rule — which is what this was — is not a signal; "act now" and "on
    track" have to differ in hue, in weight and in the words themselves, and the
    icon carries it for anyone who doesn't see the hue at all.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import { GLOSSARY } from "../lib/glossary.js";

    let { recommendations = [] } = $props();

    const SEVERITY = {
        critical: { label: "Act now", tone: "bad", icon: "!" },
        warning: { label: "Watch", tone: "warn", icon: "▲" },
        info: { label: "Note", tone: "info", icon: "i" },
        good: { label: "On track", tone: "good", icon: "✓" },
    };

    const items = $derived(
        (recommendations || []).map((rec) => ({
            ...rec,
            meta: SEVERITY[rec.severity] || { label: rec.severity, tone: "info", icon: "i" },
        })),
    );

    const counts = $derived.by(() => {
        const acted = items.filter((r) => r.severity === "critical" || r.severity === "warning").length;
        return { acted, total: items.length };
    });

    function readout(rec) {
        if (!Number.isFinite(rec.metric)) return null;
        const value = Math.abs(rec.metric) < 10 ? rec.metric.toFixed(2) : Math.round(rec.metric);
        if (!Number.isFinite(rec.threshold)) return `${value}`;
        const limit = Math.abs(rec.threshold) < 10 ? rec.threshold.toFixed(2) : Math.round(rec.threshold);
        return `${value} vs ${limit}`;
    }
</script>

<Card title="What to do about it" info={GLOSSARY.recommendations}>
    {#snippet aside()}
        {#if counts.total > 0}
            <p class="tally">
                {#if counts.acted === 0}
                    nothing needs changing
                {:else}
                    {counts.acted} of {counts.total} need attention
                {/if}
            </p>
        {/if}
    {/snippet}

    {#if items.length === 0}
        <p class="empty">Not enough training data yet to say anything useful.</p>
    {:else}
        <ul>
            {#each items as rec (rec.id)}
                <li class="rec tone-{rec.meta.tone}">
                    <div class="rec-head">
                        <span class="rec-badge">
                            <span class="rec-icon" aria-hidden="true">{rec.meta.icon}</span>
                            {rec.meta.label}
                        </span>
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
</Card>

<style>
    .tally {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.65;
        margin: 0;
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

    /* A darker tile on the card's lighter surface: the boundary has to be
       visible without a heavy border, and both surfaces are theme tokens so
       the relationship holds in light and dark. */
    .rec {
        padding: var(--space-4);
        padding-left: var(--space-5);
        border-radius: var(--radius-md);
        background: var(--item-background);
        border: 1px solid var(--main-green-translucent);
        border-left: 4px solid var(--tone);
        box-shadow: var(--inner-box-shadow);
    }
    .tone-bad { --tone: var(--tone-bad); --tone-bg: var(--tone-bad-bg); }
    .tone-warn { --tone: var(--tone-warn); --tone-bg: var(--tone-warn-bg); }
    .tone-info { --tone: var(--tone-info); --tone-bg: var(--tone-info-bg); }
    .tone-good { --tone: var(--tone-good); --tone-bg: var(--tone-good-bg); }

    .rec-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-3);
    }
    .rec-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: 3px var(--space-2) 3px 5px;
        border-radius: var(--radius-pill);
        background: var(--tone-bg);
        font-size: var(--font-2xs);
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--tone);
    }
    .rec-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.1em;
        height: 1.1em;
        border-radius: 50%;
        background: var(--tone);
        color: var(--badge-text-colour);
        font-size: 0.85em;
        font-weight: 700;
        line-height: 1;
        /* The glyphs are different sizes; nudge them onto the same centre. */
        text-indent: 0.02em;
    }

    .rec-metric {
        font-family: var(--font-serif);
        font-size: var(--font-xs);
        color: var(--paragraph-colour);
        opacity: 0.7;
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
        opacity: 0.9;
        margin: 0;
        max-width: 78ch;
    }
</style>
