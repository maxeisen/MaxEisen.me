<!--
    Ranked training recommendations.

    Every card shows the number that triggered it next to the threshold it
    crossed. That's the point of the deterministic rule engine: advice you can
    argue with, rather than advice you have to trust.

    Severity has to survive a glance. Four levels separated only by the shade of
    a 3px rule — which is what this was — is not a signal; "act now" and "on
    track" have to differ in hue, in weight and in the words themselves, and the
    icon carries it for anyone who doesn't see the hue at all.

    Each card leads with its opening sentence and folds the rest away. The rules
    are written to put the measurement first and the reasoning after it, so the
    visible line is always the evidence — and a dozen cards of full reasoning
    was a panel you scrolled past rather than read. The short ones, which are a
    single sentence, get no expander at all.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import { readout, splitLead } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { recommendations = [] } = $props();

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

<!--
    Outline marks on a 16-unit box rather than typographic glyphs: "✓", "!" and
    "▲" are set on a text baseline at different heights and optical weights, so
    no amount of line-height gets all four sitting square in the same badge.
    Shape carries the severity as well as colour does — the triangle is the one
    you look for — which is what makes the ranking readable without relying on
    hue at all.
-->
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

<Card title="Recommendations" info={GLOSSARY.recommendations}>
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
    .tally {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.65;
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
        gap: 5px;
        padding: 3px var(--space-2) 3px 6px;
        border-radius: var(--radius-pill);
        background: var(--tone-bg);
        font-size: var(--font-2xs);
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--tone);
    }
    .rec-icon {
        flex: none;
        width: 1.25em;
        height: 1.25em;
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.4;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    .rec-icon .dot {
        fill: currentColor;
        stroke: none;
    }

    /* A native disclosure rather than a state flag and a click handler: it
       comes with the button semantics, the keyboard behaviour and the
       expanded/collapsed announcement already correct, and find-in-page can
       still reach the text inside it. Only the marker is replaced, because
       the default triangle is a different shape in every browser. */
    details {
        margin-top: var(--space-3);
    }
    summary {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        width: fit-content;
        cursor: pointer;
        font-size: var(--font-2xs);
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--tone);
        opacity: 0.8;
        list-style: none;
        border-radius: var(--radius-sm);
    }
    summary::-webkit-details-marker { display: none; }
    summary:hover { opacity: 1; }
    summary:focus-visible {
        outline: 2px solid var(--tone);
        outline-offset: 3px;
    }
    /* Half a square rotated into a chevron, so it points from the same box
       whichever way it's turned — a glyph would shift on its baseline. */
    summary::after {
        content: "";
        width: 0.4em;
        height: 0.4em;
        border-right: 1.5px solid currentColor;
        border-bottom: 1.5px solid currentColor;
        transform: translateY(-0.12em) rotate(45deg);
        transition: transform 0.15s ease;
    }
    details[open] summary::after {
        transform: translateY(0.08em) rotate(-135deg);
    }
    .rest { margin-top: var(--space-2); }

    @media (prefers-reduced-motion: reduce) {
        summary::after { transition: none; }
    }

    .rec-metric {
        font-family: var(--font-sans);
        font-size: var(--font-xs);
        color: var(--paragraph-colour);
        opacity: 0.7;
        white-space: nowrap;
    }
    h3 {
        font-family: var(--font-sans);
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
