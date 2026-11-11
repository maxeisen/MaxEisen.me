<!--
    A project, opened from the homepage's Projects grid: the screenshot up
    top, then the name, its years and where to see it, the stack as chips,
    and what it is as a ruled list (the same list the experience modal uses).
-->
<script>
    import RuledList from "../../../lib/ui/RuledList.svelte";

    let { name, technologies = "", year, bullets = [], githubLink = null, projectLink = null, screenshot } = $props();

    const stack = $derived(
        String(technologies)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
    );
</script>

<article class="project">
    <figure class="shot">
        <picture>
            <source srcset="./img/screenshots/{screenshot}.webp" type="image/webp">
            <img src="./img/screenshots/{screenshot}.jpg" alt="{name} screenshot">
        </picture>
    </figure>

    <header>
        <div class="title">
            <h2>{name}</h2>
            <span class="year">{year.replace("-", " – ")}</span>
        </div>
        {#if projectLink || githubLink}
            <div class="links">
                {#if projectLink}
                    <a class="link primary" href={projectLink} rel="noreferrer" target="_blank">
                        Visit
                    </a>
                {/if}
                {#if githubLink}
                    <a class="link" href={githubLink} rel="noreferrer" target="_blank">
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .2a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.33.66.07-.52.28-.87.5-1.07-1.77-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 .2Z"/></svg>
                        Source
                    </a>
                {/if}
            </div>
        {/if}
    </header>

    {#if stack.length}
        <ul class="stack" aria-label="Built with">
            {#each stack as tech (tech)}
                <li>{tech}</li>
            {/each}
        </ul>
    {/if}

    {#if bullets.length}
        <h3 class="kicker">What it is</h3>
        <RuledList items={bullets} html />
    {/if}
</article>

<style>
    .project { text-align: left; }

    /* The screenshot sits in a window-like frame so light and dark
       screenshots both have an edge against the modal. */
    .shot {
        margin: 0 0 var(--space-5);
        padding: 6px;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background: var(--surface-2);
    }
    .shot img {
        display: block;
        width: 100%;
        max-height: min(40vh, 320px);
        object-fit: cover;
        object-position: top;
        border-radius: calc(var(--radius-lg) - 6px);
    }

    header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-3) var(--space-4);
    }
    .title { display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px var(--space-3); }
    h2 { margin: 0; font-size: var(--font-xl); font-weight: var(--weight-semibold); letter-spacing: -0.02em; }
    .year { font-size: var(--font-sm); font-variant-numeric: tabular-nums; color: var(--text-3); }

    .links { display: flex; gap: var(--space-2); }
    .link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding: 0 12px;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius);
        font-size: var(--font-xs);
        font-weight: var(--weight-medium);
        color: var(--text);
        transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
    }
    .link:hover { background: var(--surface-2); color: var(--text-strong); }
    .link svg { width: 14px; height: 14px; fill: currentColor; }
    .link.primary { background: var(--text-strong); border-color: var(--text-strong); color: var(--bg); }
    .link.primary:hover { background: var(--text); color: var(--bg); }

    /* The stack as a row of chips, the first one — what it's built on —
       carrying the accent. */
    .stack {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: var(--space-4) 0 0;
        padding: var(--space-4) 0 0;
        border-top: 1px solid var(--border);
        list-style: none;
    }
    .stack li {
        padding: 3px 10px;
        border: 1px solid var(--border);
        border-radius: var(--radius-pill);
        font-size: var(--font-xs);
        font-weight: var(--weight-medium);
        color: var(--text);
        background: var(--surface);
    }
    .stack li:first-child { border-color: var(--accent); background: var(--accent-soft); color: var(--text-strong); }

    h3 { margin: var(--space-5) 0 var(--space-1); }
</style>
