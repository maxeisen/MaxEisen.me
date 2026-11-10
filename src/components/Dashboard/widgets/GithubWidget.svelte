<!--
    Latest public push + 53-week contribution heatmap. Reports itself
    unavailable if the feed never loads (or the function isn't configured,
    503, e.g. missing token).

    Size tiers (container queries on the slot): the heatmap takes whatever
    height is left; a short slot trims the commit message to one line, then
    drops the push details, leaving the repo and the heatmap.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import { timeAgo } from "../lib/utils.js";
    import { isFetchErrorStatus } from "../../../lib/data/fetchJson.js";
    import { createSWRWidgetFeed } from "../lib/widgetFeed.js";
    import WidgetHeader from "./WidgetHeader.svelte";
    import Spinner from "../../../lib/ui/Spinner.svelte";

    let { onavailability = () => {} } = $props();

    let loaded = $state(false);
    let repo = $state("—");
    let message = $state("");
    let meta = $state("—");
    let widgetHref = $state("https://github.com/maxeisen");
    let weeks = $state(null);
    let total = $state("—");
    let range = $state("—");
    let stopPoll;

    function levelFor(count, max) {
        if (count <= 0) return 0;
        if (max <= 1) return 4;
        const ratio = count / max;
        if (ratio < 0.25) return 1;
        if (ratio < 0.5) return 2;
        if (ratio < 0.75) return 3;
        return 4;
    }

    function shortDate(iso) {
        return new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    function labelFor(iso) {
        return new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    }

    const todayIso = $derived(new Date().toISOString().slice(0, 10));
    const heatmapMax = $derived(weeks ? Math.max(1, ...weeks.flatMap((w) => w.days.map((d) => d.count))) : 1);
    const heatmapCols = $derived(weeks ? weeks.length : 0);

    function apply(data) {
        loaded = true;
        onavailability(true);
        const latest = data?.latest;
        const contrib = data?.contributions;
        if (latest) {
            repo = latest.repo || "—";
            message = latest.message || "—";
            meta = `${latest.commits || 1} commit${latest.commits === 1 ? "" : "s"} · ${timeAgo(latest.createdAt)}`;
            if (latest.url) widgetHref = latest.url;
        } else {
            repo = "No recent public pushes";
            message = "";
            meta = "";
        }
        if (contrib) {
            weeks = contrib.weeks || [];
            total = contrib.total ?? 0;
            if (weeks.length) {
                const firstDay = weeks[0].days[0]?.date;
                const lastWeek = weeks[weeks.length - 1].days;
                const lastDay = lastWeek[lastWeek.length - 1]?.date;
                if (firstDay && lastDay) range = `${shortDate(firstDay)} – ${shortDate(lastDay)}`;
            }
        }
    }

    // Shared SWR + poll lifecycle helper keeps widget data loading consistent
    // across dashboard cards while each widget owns its own `apply()` mapper.
    const feed = createSWRWidgetFeed({
        url: "/.netlify/functions/githubLatest",
        apply,
        // A failure after a good load keeps the last push up.
        onError: (e) => {
            if (!loaded || isFetchErrorStatus(e, 503)) onavailability(false);
        },
    });

    onMount(() => {
        stopPoll = feed.start();
    });
    onDestroy(() => stopPoll?.());
</script>

<WidgetHeader profileHref="https://github.com/maxeisen" profileLabel="GitHub" label="Code" />
{#if !loaded}
    <div class="widget-loading" role="status" aria-label="Loading">
        <Spinner size={24} stroke={2} />
    </div>
{:else}
<a class="github-main" href={widgetHref} target="_blank" rel="noreferrer">
    <div class="github-repo">{repo}</div>
    <div class="github-message">{message}</div>
    <div class="github-meta">{meta}</div>
    <div class="github-heatmap-wrap">
        <div class="github-heatmap-rows" aria-hidden="true">
            <span></span><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span>
        </div>
        <div class="github-heatmap" style:grid-template-columns={weeks ? `repeat(${heatmapCols}, minmax(0, 1fr))` : null}>
            {#if weeks}
                {#each weeks as w}
                    {#each w.days as d}
                        {#if d.future}
                            <div class="github-cell future" aria-hidden="true"></div>
                        {:else}
                            {@const lvl = levelFor(d.count, heatmapMax)}
                            <div
                                class="github-cell {lvl > 0 ? `l${lvl}` : ''} {d.date === todayIso ? 'today' : ''}"
                                title={`${labelFor(d.date)}: ${d.count} contribution${d.count === 1 ? "" : "s"}`}
                            ></div>
                        {/if}
                    {/each}
                {/each}
            {/if}
        </div>
    </div>
    <div class="github-graph-meta">
        <span><span class="github-graph-total">{total}</span> public contributions</span>
        <span>{range}</span>
    </div>
</a>
{/if}

<style>
    .github-main {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        color: inherit;
    }
    .github-main:hover .github-repo { color: var(--accent); }
    .github-repo,
    .github-message,
    .github-meta,
    .github-graph-meta { flex-shrink: 0; }
    .github-repo {
        font-size: clamp(0.95rem, 2.6cqi, 1.25rem);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.015em;
        color: var(--text-strong);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color var(--dur-fast) var(--ease);
    }
    .github-message {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        margin-top: var(--space-1);
        font-size: var(--font-sm);
        color: var(--text);
    }
    .github-meta { margin-top: 2px; font-size: var(--font-xs); color: var(--text-3); }
    .github-heatmap-wrap {
        display: flex;
        align-items: stretch;
        flex: 1 1 0;
        gap: 6px;
        min-width: 0;
        min-height: 28px;
        margin-top: var(--space-3);
        overflow: hidden;
    }
    .github-heatmap-rows {
        display: grid;
        grid-template-rows: repeat(7, 1fr);
        flex: 0 0 auto;
        gap: 2px;
        font-size: var(--font-2xs);
        color: var(--text-3);
    }
    .github-heatmap-rows span { display: flex; align-items: center; line-height: 1; }
    .github-heatmap {
        display: grid;
        grid-auto-flow: column;
        grid-template-rows: repeat(7, minmax(0, 1fr));
        flex: 1 1 0;
        gap: 2px;
        min-width: 0;
        height: 100%;
    }
    /* One hue, light to dark: a sequential scale for a count. */
    .github-cell { min-width: 0; min-height: 0; border-radius: 2px; background: var(--surface-2); }
    .github-cell.l1 { background: color-mix(in oklab, var(--series-1) 30%, var(--surface-2)); }
    .github-cell.l2 { background: color-mix(in oklab, var(--series-1) 55%, var(--surface-2)); }
    .github-cell.l3 { background: color-mix(in oklab, var(--series-1) 78%, var(--surface-2)); }
    .github-cell.l4 { background: var(--series-1); }
    .github-cell.future { background: transparent; box-shadow: inset 0 0 0 1px var(--border); }
    .github-cell.today { box-shadow: inset 0 0 0 1.5px var(--text-strong); }
    .github-graph-meta {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-top: var(--space-2);
        font-size: var(--font-xs);
        color: var(--text-2);
    }
    .github-graph-total { font-weight: var(--weight-semibold); color: var(--text-strong); }

    @container slot (max-height: 280px) {
        .github-message { -webkit-line-clamp: 1; }
        .github-heatmap-wrap { margin-top: var(--space-2); }
    }
    @container slot (max-height: 220px) {
        .github-meta { display: none; }
    }
    /* The M/W/F labels need ~100px of heatmap; below that they'd be cut. */
    @container slot (max-height: 260px) {
        .github-heatmap-rows { display: none; }
    }
    @container slot (max-height: 170px) {
        .github-message { display: none; }
        .github-graph-meta { margin-top: var(--space-1); }
    }
    @container slot (max-width: 300px) {
        .github-graph-meta > span:last-child { display: none; }
    }
</style>
