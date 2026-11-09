<!--
    The title block at the top of a page.

    Props
      kicker    a short line above the title ("Run log")
      title     the page name
      subtitle  a line under it — string, or pass the `sub` snippet
      aside     snippet on the right (a countdown, a figure)
-->
<script>
    let { kicker = null, title, subtitle = null, sub = null, aside = null } = $props();
</script>

<div class="page-header">
    <div class="titles">
        {#if kicker}<p class="kicker">{kicker}</p>{/if}
        <h1>{title}</h1>
        {#if sub}
            <div class="subtitle">{@render sub()}</div>
        {:else if subtitle}
            <p class="subtitle">{subtitle}</p>
        {/if}
    </div>
    {#if aside}
        <div class="aside">{@render aside()}</div>
    {/if}
</div>

<style>
    .page-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--space-4) var(--space-6);
        flex-wrap: wrap;
        margin: 0 0 var(--space-6);
    }
    .titles { min-width: 0; }
    .kicker { margin-bottom: var(--space-2); }
    h1 {
        margin: 0;
        font-size: var(--font-3xl);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.03em;
        line-height: 1;
        color: var(--text-strong);
    }
    .subtitle {
        margin: var(--space-3) 0 0;
        max-width: 60ch;
        font-size: var(--font-sm);
        color: var(--text-2);
    }
    .aside { flex: none; }
</style>
