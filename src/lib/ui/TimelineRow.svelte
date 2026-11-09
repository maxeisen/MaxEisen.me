<!--
    One entry in a résumé-style list: dates in a left column, the entry
    beside them. Clickable when given an onclick (opens the detail modal).

    Props
      when      the date range
      title     the role / school
      at        the organisation, in quieter ink after the title
      desc      a sentence about it
      meta      a trailing detail (location)
      badge     snippet after the title (a "Current" Tag)
      onclick   makes the row a button
-->
<script>
    let { when = "", title, at = "", desc = "", meta = "", badge = null, onclick = null } = $props();
</script>

{#snippet body()}
    <span class="when">{when}</span>
    <span class="what">
        <span class="title">
            {title}
            {#if at}<span class="at">at {at}</span>{/if}
            {@render badge?.()}
        </span>
        {#if desc}<span class="desc">{desc}</span>{/if}
        {#if meta}<span class="meta">{meta}</span>{/if}
    </span>
{/snippet}

{#if onclick}
    <button type="button" class="row clickable" {onclick}>{@render body()}</button>
{:else}
    <div class="row">{@render body()}</div>
{/if}

<style>
    .row {
        display: grid;
        grid-template-columns: 9.5rem minmax(0, 1fr);
        gap: var(--space-1) var(--space-5);
        width: calc(100% + 2 * var(--space-3));
        margin: 0 calc(-1 * var(--space-3));
        padding: var(--space-3);
        border: 0;
        border-radius: var(--radius);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
    }
    .clickable { cursor: pointer; transition: background var(--dur-fast) var(--ease); }
    .clickable:hover { background: var(--surface-2); }
    .when {
        padding-top: 2px;
        font-size: var(--font-xs);
        font-variant-numeric: tabular-nums;
        color: var(--text-3);
    }
    .what { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .title {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 2px var(--space-2);
        font-weight: var(--weight-semibold);
        color: var(--text-strong);
    }
    .at { font-weight: var(--weight-regular); color: var(--text-2); }
    .desc { font-size: var(--font-sm); line-height: 1.5; color: var(--text-2); }
    .meta { font-size: var(--font-xs); color: var(--text-3); }

    @media (max-width: 620px) {
        .row { grid-template-columns: minmax(0, 1fr); }
        .when { order: 2; padding-top: 0; }
    }
</style>
