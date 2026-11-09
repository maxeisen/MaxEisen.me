<!--
    A list of statements separated by hairlines, each with a small accent
    marker: what a role involved, what a project does.

    Props
      items  strings
      html   render items as HTML (content files with inline links). Links
             to other sites get a small ↗ so they read as leaving.
-->
<script>
    let { items = [], html = false } = $props();
</script>

<ul class="ruled">
    {#each items as item}
        <li>{#if html}{@html item}{:else}{item}{/if}</li>
    {/each}
</ul>

<style>
    .ruled { margin: 0; padding: 0; list-style: none; }
    li {
        position: relative;
        padding: var(--space-3) 0 var(--space-3) var(--space-4);
        font-size: var(--font-sm);
        line-height: 1.55;
        color: var(--text);
    }
    li + li { border-top: 1px solid var(--border); }
    li::before {
        content: "";
        position: absolute;
        left: 0;
        top: calc(var(--space-3) + 0.6em);
        width: 6px;
        height: 6px;
        border-radius: 1px;
        background: var(--accent);
    }
    li :global(a) {
        color: var(--text-strong);
        text-decoration: underline;
        text-decoration-color: var(--border-strong);
        text-underline-offset: 0.2em;
        transition: text-decoration-color var(--dur-fast) var(--ease);
    }
    li :global(a:hover) { text-decoration-color: currentColor; }
    li :global(a[target="_blank"])::after {
        content: "↗";
        margin-left: 1px;
        font-size: 0.75em;
        vertical-align: 0.3em;
        color: var(--text-3);
    }
</style>
