<!--
    A titled section of a long page: a hairline, a heading, the content.

    Props
      title  heading text
      id     anchor id (for /#experience links)
      level  heading level (2)
      aside  snippet on the right of the heading
-->
<script>
    let { title, id = undefined, level = 2, aside = null, children } = $props();
</script>

<section class="section" {id}>
    <div class="section-head">
        <svelte:element this={`h${level}`} class="section-title">{title}</svelte:element>
        {#if aside}<div class="section-aside">{@render aside()}</div>{/if}
    </div>
    {@render children()}
</section>

<style>
    .section {
        padding-top: var(--space-5);
        border-top: 1px solid var(--border);
        scroll-margin-top: calc(var(--nav-height) + var(--space-4));
    }
    .section + :global(.section) { margin-top: var(--space-8); }
    .section-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-5);
    }
    .section-title {
        margin: 0;
        font-size: var(--font-sm);
        font-weight: var(--weight-semibold);
        letter-spacing: 0;
        color: var(--text-strong);
    }
    .section-aside { font-size: var(--font-xs); color: var(--text-3); }
</style>
