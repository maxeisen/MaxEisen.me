<!--
    The degree, opened from the homepage's Education row. Same shape as the
    experience modal: heading, a row of facts, then the detail. Courses and
    committees are comma lists in the content file; they show as wrapped
    chips, and an asterisk (a course I TA'd, a committee I led) becomes a
    marked chip rather than a footnote.
-->
<script>
    import Stat from "../../../lib/ui/Stat.svelte";
    import StatGrid from "../../../lib/ui/StatGrid.svelte";

    let { school, location, degree, major, years, courses = "", committees = "" } = $props();

    const split = (list) =>
        String(list || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => ({ label: s.replaceAll("*", ""), starred: s.includes("*") }));

    const courseList = $derived(split(courses));
    const committeeList = $derived(split(committees));
</script>

<article class="edu">
    <header>
        <h2>{school}</h2>
        <p class="degree">{@html degree}</p>
    </header>

    <StatGrid columns={3} rule="both" gap={3}>
        <Stat size="sm" label="When" value={years.replace(" - ", " – ")} />
        <Stat size="sm" label="Where" value={location} />
        <Stat size="sm" label="Major">{@html major}</Stat>
    </StatGrid>

    {#snippet chips(items)}
        <ul class="chips">
            {#each items as item (item.label)}
                <li class:starred={item.starred}>{item.label}</li>
            {/each}
        </ul>
    {/snippet}

    <h3 class="kicker">Relevant courses</h3>
    {@render chips(courseList)}

    <h3 class="kicker">Committees</h3>
    {@render chips(committeeList)}

    <p class="key"><span class="swatch"></span>Teaching assistant or executive position</p>
</article>

<style>
    .edu { text-align: left; }
    header { margin-bottom: var(--space-4); padding-right: var(--space-6); }
    h2 { margin: 0; font-size: var(--font-xl); font-weight: var(--weight-semibold); letter-spacing: -0.02em; }
    .degree { margin: var(--space-1) 0 0; color: var(--text-2); }
    .degree :global(a), .edu :global(.stat-value a) { color: inherit; text-decoration: underline; text-decoration-color: var(--border-strong); text-underline-offset: 0.2em; }
    h3 { margin: var(--space-5) 0 var(--space-2); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .chips li {
        padding: 2px 8px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        font-size: var(--font-xs);
        color: var(--text);
    }
    .chips li.starred { border-color: var(--accent); background: var(--accent-soft); color: var(--text-strong); }
    .key { display: flex; align-items: center; gap: 6px; margin: var(--space-4) 0 0; font-size: var(--font-2xs); color: var(--text-3); }
    .swatch { width: 10px; height: 10px; border: 1px solid var(--accent); border-radius: 2px; background: var(--accent-soft); }
</style>
