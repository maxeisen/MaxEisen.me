<!--
    Ranked training recommendations. Every card shows the number that
    triggered it next to the threshold it crossed.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import { readout, splitLead } from "../lib/format.js";
    import { GLOSSARY } from "../../Training/lib/glossary.js";

    let { recommendations = [], info = GLOSSARY.recommendations } = $props();

    const SEVERITY = {
        critical: { label: "Act now", tone: "bad", icon: "alert" },
        warning: { label: "Watch", tone: "warn", icon: "warn" },
        info: { label: "Note", tone: "info", icon: "info" },
        good: { label: "On track", tone: "good", icon: "check" },
    };

    const items = $derived(
        (recommendations || []).map((rec) => ({
            ...rec,
            meta: SEVERITY[rec.severity] || { label: rec.severity, tone: "info", icon: "i" },
            ...splitLead(rec.detail),
            readout: readout(rec.metric, rec.threshold, rec.unit),
        })),
    );

    const counts = $derived.by(() => {
        const acted = items.filter((r) => r.severity === "critical" || r.severity === "warning").length;
        return { acted, total: items.length };
    });

</script>

<!-- SVG marks rather than glyphs — "✓" / "!" sit on different baselines. -->
{#snippet glyph(kind)}
    <svg class="rec-icon" viewBox="0 0 16 16" aria-hidden="true">
        {#if kind === "warn"}
            <path d="M8 2.6 L14.6 13.4 H1.4 Z" />
            <path d="M8 6.4 V9.6" />
            <circle class="dot" cx="8" cy="11.5" r="0.85" />
        {:else}
            <circle cx="8" cy="8" r="6.2" />
            {#if kind === "check"}
                <path d="M5 8.3 L7.1 10.4 L11 5.9" />
            {:else if kind === "alert"}
                <path d="M8 4.4 V8.6" />
                <circle class="dot" cx="8" cy="11" r="0.85" />
            {:else}
                <circle class="dot" cx="8" cy="5" r="0.85" />
                <path d="M8 7.4 V11.6" />
            {/if}
        {/if}
    </svg>
{/snippet}

<Card title="Recommendations" {info}>
    {#snippet aside()}
        {#if counts.total > 0}
            <p>
                {#if counts.acted === 0}
                    nothing needs changing
                {:else}
                    {counts.acted} of {counts.total} need attention
                {/if}
            </p>
        {/if}
    {/snippet}

    {#if items.length === 0}
        <p class="card-empty">Not enough training data yet to say anything useful.</p>
    {:else}
        <ul>
            {#each items as rec (rec.id)}
                <li class="rec tone-{rec.meta.tone}">
                    <div class="rec-head">
                        <span class="rec-badge">
                            {@render glyph(rec.meta.icon)}
                            {rec.meta.label}
                        </span>
                        {#if rec.readout}
                            <span class="rec-metric" title="Measured value against its threshold">{rec.readout}</span>
                        {/if}
                    </div>
                    <h3>{rec.title}</h3>
                    <p>{rec.lead}</p>
                    {#if rec.rest}
                        <details>
                            <summary>Why this matters</summary>
                            <p class="rest">{rec.rest}</p>
                        </details>
                    {/if}
                </li>
            {/each}
        </ul>
    {/if}
</Card>

<style>
    /* A ruled list rather than a stack of tinted boxes. Severity is carried
       by the icon and its label, in the tone colour; the copy stays in text
       colours so six recommendations don't turn the card into a rainbow. */
    ul {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .rec {
        padding: var(--space-4) 0;
        border-top: 1px solid var(--border);
    }
    .rec:first-child { padding-top: 0; border-top: 0; }
    .rec:last-child { padding-bottom: 0; }
    .tone-bad { --tone: var(--tone-bad); }
    .tone-warn { --tone: var(--tone-warn); }
    .tone-info { --tone: var(--tone-info); }
    .tone-good { --tone: var(--tone-good); }

    .rec-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-2);
    }
    .rec-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--font-xs);
        font-weight: var(--weight-semibold);
        color: var(--tone);
    }
    .rec-icon {
        flex: none;
        width: 15px;
        height: 15px;
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    .rec-icon .dot { fill: currentColor; stroke: none; }

    .rec-metric {
        font-size: var(--font-xs);
        font-variant-numeric: tabular-nums;
        color: var(--text-3);
        white-space: nowrap;
    }
    h3 {
        margin: 0 0 var(--space-1);
        font-size: var(--font-md);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.01em;
        color: var(--text-strong);
    }
    p {
        margin: 0;
        max-width: 72ch;
        font-size: var(--font-sm);
        line-height: 1.55;
        color: var(--text-2);
    }

    /* Native <details>: keyboard, expanded/collapsed, and find-in-page. */
    details { margin-top: var(--space-2); }
    summary {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        width: fit-content;
        cursor: pointer;
        font-size: var(--font-xs);
        font-weight: var(--weight-medium);
        color: var(--text-2);
        list-style: none;
        border-radius: var(--radius-sm);
        transition: color var(--dur-fast) var(--ease);
    }
    summary::-webkit-details-marker { display: none; }
    summary:hover { color: var(--text-strong); }
    /* Half a square rotated into a chevron. */
    summary::after {
        content: "";
        width: 0.38em;
        height: 0.38em;
        border-right: 1.5px solid currentColor;
        border-bottom: 1.5px solid currentColor;
        transform: translateY(-0.12em) rotate(45deg);
        transition: transform var(--dur-fast) var(--ease);
    }
    details[open] summary::after { transform: translateY(0.08em) rotate(-135deg); }
    .rest { margin-top: var(--space-2); }

    @media (prefers-reduced-motion: reduce) {
        summary::after { transition: none; }
    }
</style>
