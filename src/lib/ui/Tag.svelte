<!--
    A small inline label: a run's effort, a plan type, a status.

    Props
      tone     "neutral" (default) | "accent" | "good" | "warn" | "bad" | "info"
      outline  border instead of fill — for the quieter of two tags
      dot      a leading dot, for a status ("Recovering well")
      size     "sm" (default) | "md"
      title    tooltip
      class    extra classes (hooks for tests and styling)
-->
<script>
    let {
        tone = "neutral",
        outline = false,
        dot = false,
        size = "sm",
        title = undefined,
        class: className = "",
        children,
    } = $props();
</script>

<span class="tag tone-{tone} size-{size} {className}" class:outline class:dot {title}>{@render children()}</span>

<style>
    .tag {
        --c: var(--text-2);
        --bg: var(--surface-2);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 1px 7px;
        border-radius: var(--radius-sm);
        background: var(--bg);
        color: var(--c);
        font-size: var(--font-2xs);
        font-weight: var(--weight-medium);
        line-height: 1.5;
        white-space: nowrap;
    }
    .size-md { padding: 3px 10px; font-size: var(--font-xs); }
    .outline { background: transparent; box-shadow: inset 0 0 0 1px var(--border-strong); }
    .dot::before {
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
    }

    .tone-accent { --c: var(--accent); --bg: var(--accent-soft); }
    .tone-good { --c: var(--tone-good); --bg: var(--tone-good-bg); }
    .tone-warn { --c: var(--tone-warn); --bg: var(--tone-warn-bg); }
    .tone-bad { --c: var(--tone-bad); --bg: var(--tone-bad-bg); }
    .tone-info { --c: var(--tone-info); --bg: var(--tone-info-bg); }
</style>
