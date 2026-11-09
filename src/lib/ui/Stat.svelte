<!--
    A labelled figure: label above, value, optional note below.

    The one way the site shows "a number and what it is" — headline tiles,
    the four-up under a run, the details under a chart. Put several in a
    StatGrid.

    Props
      label   what the number is (sentence case)
      value   the figure; or pass children for markup (a trend arrow, units)
      note    a qualifier under the value ("to 24.7", "last 4 weeks")
      tone    "good" | "warn" | "bad" — only when the colour *means* something
      size    "sm" | "md" (default) | "lg" | "xl"
-->
<script>
    let { label = "", value = null, note = null, tone = null, size = "md", children } = $props();
</script>

<div class="stat size-{size}" class:tone-good={tone === "good"} class:tone-warn={tone === "warn"} class:tone-bad={tone === "bad"}>
    {#if label}<span class="stat-label">{label}</span>{/if}
    <span class="stat-value">{#if children}{@render children()}{:else}{value ?? "—"}{/if}</span>
    {#if note}<span class="stat-note">{note}</span>{/if}
</div>

<style>
    .stat {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }
    .stat-label {
        font-size: var(--font-2xs);
        font-weight: var(--weight-medium);
        line-height: 1.3;
        color: var(--text-2);
    }
    .stat-value {
        font-weight: var(--weight-semibold);
        line-height: 1.2;
        letter-spacing: -0.01em;
        color: var(--text-strong);
        overflow-wrap: anywhere;
    }
    .stat-note {
        font-size: var(--font-2xs);
        line-height: 1.35;
        color: var(--text-3);
    }

    .size-sm .stat-value { font-size: var(--font-sm); }
    .size-md .stat-value { font-size: var(--font-md); }
    .size-lg .stat-value { font-size: var(--font-xl); letter-spacing: -0.02em; }
    .size-lg { gap: var(--space-1); }
    .size-xl .stat-value { font-size: clamp(2rem, 5vw, 2.75rem); letter-spacing: -0.03em; line-height: 1.05; }
    .size-xl { gap: var(--space-1); }
    .size-xl .stat-label { font-size: var(--font-xs); }

    .tone-good .stat-value { color: var(--tone-good); }
    .tone-warn .stat-value { color: var(--tone-warn); }
    .tone-bad .stat-value { color: var(--tone-bad); }
</style>
