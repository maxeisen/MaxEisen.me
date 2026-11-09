<!--
    The card: one surface for every panel on the site — activity panels,
    dashboard widgets (via the .surface class they share), homepage cards.

    Props
      title   heading text; omit for a headless card
      level   heading level (2)
      info    { body: string[], terms: [{term, definition}] } — adds an
              in-flow "what does this mean" disclosure under the heading
              (in flow, not a popover, so it can never leave the card)
      aside   snippet, right of the title — a date, a legend, a count
      flush   drop the padding (media cards)
      as      element ("section")

    Conventions children can rely on inside a card:
      .card-empty   the "nothing here yet" line
      .chart-unit   the caption under a chart
-->
<script>
    let {
        title = null,
        level = 2,
        info = null,
        aside = null,
        flush = false,
        as = "section",
        class: className = "",
        children,
        ...rest
    } = $props();

    let open = $state(false);
    const panelId = `card-info-${Math.random().toString(36).slice(2, 9)}`;
</script>

<svelte:element this={as} class="card surface {className}" class:flush {...rest}>
    {#if title || aside}
        <div class="card-head">
            {#if title}
                <svelte:element this={`h${level}`} class="card-title">
                    {title}
                    {#if info}
                        <button
                            type="button"
                            class="info-btn"
                            class:open
                            aria-expanded={open}
                            aria-controls={panelId}
                            aria-label={open ? `Hide what ${title} means` : `What does ${title} mean?`}
                            onclick={() => (open = !open)}
                        >?</button>
                    {/if}
                </svelte:element>
            {/if}
            {#if aside}
                <div class="card-aside">{@render aside()}</div>
            {/if}
        </div>
    {/if}

    {#if info && open}
        <div class="info-panel" id={panelId}>
            {#each info.body || [] as paragraph}
                <p>{paragraph}</p>
            {/each}
            {#if info.terms?.length}
                <dl>
                    {#each info.terms as { term, definition }}
                        <dt>{term}</dt>
                        <dd>{definition}</dd>
                    {/each}
                </dl>
            {/if}
        </div>
    {/if}

    {@render children?.()}
</svelte:element>

<style>
    .card {
        --card-pad: 20px;
        padding: var(--card-pad);
        min-width: 0;
    }
    .card.flush { padding: 0; overflow: hidden; }

    .card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-2) var(--space-3);
        flex-wrap: wrap;
        margin-bottom: var(--space-4);
    }
    .card-title {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--font-md);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.01em;
        color: var(--text-strong);
    }
    .card-aside {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        min-width: 0;
        font-size: var(--font-xs);
        color: var(--text-2);
    }
    /* Anything an aside renders as a paragraph shouldn't add its own margin. */
    .card-aside :global(p) { margin: 0; color: inherit; }

    .info-btn {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        padding: 0;
        border: 1px solid var(--border-strong);
        border-radius: 50%;
        background: transparent;
        color: var(--text-3);
        font: inherit;
        font-size: 11px;
        font-weight: var(--weight-semibold);
        line-height: 1;
        cursor: pointer;
        transition: color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
    }
    .info-btn:hover { color: var(--text-strong); border-color: var(--text-3); }
    .info-btn.open {
        background: var(--text-strong);
        border-color: var(--text-strong);
        color: var(--surface);
    }

    .info-panel {
        margin: 0 0 var(--space-4);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius);
        background: var(--surface-2);
    }
    .info-panel p {
        margin: 0 0 var(--space-2);
        max-width: 68ch;
        font-size: var(--font-xs);
        line-height: 1.6;
        color: var(--text);
    }
    .info-panel p:last-child { margin-bottom: 0; }
    .info-panel dl {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: var(--space-1) var(--space-3);
        margin: var(--space-3) 0 0;
        font-size: var(--font-xs);
        line-height: 1.5;
    }
    .info-panel dt { font-weight: var(--weight-semibold); color: var(--text-strong); white-space: nowrap; }
    .info-panel dd { margin: 0; color: var(--text-2); }

    /* Conventions for card content. */
    .card :global(.card-empty) {
        margin: 0;
        font-size: var(--font-sm);
        color: var(--text-2);
    }
    .card :global(.chart-unit) {
        margin: var(--space-2) 0 0;
        font-size: var(--font-2xs);
        color: var(--text-3);
    }

    @media (max-width: 540px) {
        .card { --card-pad: 16px; }
        .info-panel dl { grid-template-columns: minmax(0, 1fr); }
        .info-panel dd { margin-bottom: var(--space-2); }
    }
</style>
