<!--
    A role, opened from the homepage's Experience list: the title and
    company, a row of facts (when, for how long, where), then what the work
    was, as a ruled list.
-->
<script>
    import Stat from "../../../lib/ui/Stat.svelte";
    import StatGrid from "../../../lib/ui/StatGrid.svelte";
    import RuledList from "../../../lib/ui/RuledList.svelte";
    import { monthsBetween, spanLabel, shortMonth } from "../lib/dates.js";

    let { position, company, companyLink = null, startDate, endDate, location, bullets = [] } = $props();

    const months = $derived(monthsBetween(startDate, endDate));
</script>

<article class="xp">
    <header>
        <h2>{position}</h2>
        <p class="company">
            {#if companyLink}
                <a href={companyLink} rel="noreferrer" target="_blank">{company}</a>
            {:else}
                {company}
            {/if}
        </p>
    </header>

    <StatGrid columns={3} rule="both" gap={3}>
        <Stat size="sm" label="When" value="{shortMonth(startDate)} – {shortMonth(endDate)}" />
        <Stat size="sm" label="For" value={months ? spanLabel(months) : "—"} />
        <Stat size="sm" label="Where" value={location} />
    </StatGrid>

    {#if bullets.length}
        <h3 class="kicker">What I did</h3>
        <RuledList items={bullets} />
    {/if}
</article>

<style>
    .xp { text-align: left; }
    header { margin-bottom: var(--space-4); padding-right: var(--space-6); }
    h2 {
        margin: 0;
        font-size: var(--font-xl);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.02em;
        line-height: 1.2;
    }
    .company { margin: var(--space-1) 0 0; font-size: var(--font-md); color: var(--text-2); }
    .company a { color: inherit; }
    .company a:hover { color: var(--accent); }

    h3 { margin: var(--space-5) 0 var(--space-1); }
</style>
