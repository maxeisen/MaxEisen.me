<!--
    A row of Stats that wraps to fit.

    Props
      min      narrowest a column may get, in px (110)
      columns  fix the column count instead of auto-fitting
      rule     "top" | "both" | null — hairline(s) setting the row apart
               from what's around it, in place of a tinted box
      gap      row/column gap token suffix (3 → var(--space-3))
-->
<script>
    let { min = 110, columns = null, rule = null, gap = 4, children, class: className = "" } = $props();

    const template = $derived(
        columns ? `repeat(${columns}, minmax(0, 1fr))` : `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`,
    );
</script>

<div
    class="stat-grid {className}"
    class:rule-top={rule === "top" || rule === "both"}
    class:rule-bottom={rule === "both"}
    style:grid-template-columns={template}
    style:gap="var(--space-{gap}) var(--space-{gap + 1})"
>
    {@render children()}
</div>

<style>
    .stat-grid {
        display: grid;
        min-width: 0;
    }
    .rule-top { border-top: 1px solid var(--border); padding-top: var(--space-4); }
    .rule-bottom { border-bottom: 1px solid var(--border); padding-bottom: var(--space-4); }
</style>
