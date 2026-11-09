<!--
    The key for a chart: a mark in the series colour beside a label in text
    ink. Every chart on the activity pages uses this one.

    Props
      items  [{ label, color, mark?: "line" | "dash" | "box" | "tick", value? }]
             value, when given, is printed after the label in strong ink
      note   trailing text in the quietest ink (a window, a caveat)
      under  true when it sits under a chart rather than in a card aside
-->
<script>
    let { items = [], note = null, under = false } = $props();
</script>

<p class="legend" class:under>
    {#each items as item (item.label)}
        <span class="item">
            <span class="mark mark-{item.mark || 'line'}" style:--c={item.color}></span>
            {item.label}{#if item.value != null}&nbsp;<strong>{item.value}</strong>{/if}
        </span>
    {/each}
    {#if note}<span class="note">{note}</span>{/if}
</p>

<style>
    .legend {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-4);
        margin: 0;
        font-size: var(--font-xs);
        color: var(--text-2);
    }
    .legend.under { margin-top: var(--space-2); font-size: var(--font-2xs); }
    .item { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    strong { font-weight: var(--weight-semibold); color: var(--text-strong); }
    .note { color: var(--text-3); }

    .mark { flex: none; display: inline-block; }
    .mark-line { width: 14px; border-top: 2px solid var(--c); }
    .mark-dash { width: 14px; border-top: 2px dashed var(--c); }
    .mark-box { width: 10px; height: 10px; border-radius: 2px; background: var(--c); }
    .mark-tick { width: 2px; height: 12px; border-radius: 1px; background: var(--c); }
</style>
