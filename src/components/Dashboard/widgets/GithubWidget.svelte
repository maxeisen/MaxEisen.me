<!--
    Latest public push + 53-week contribution heatmap. Hides itself if the
    backing function returns 503 (e.g. missing token).
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import { timeAgo } from "../lib/utils.js";
    import { FetchError } from "../../../lib/data/fetchJson.js";
    import { fetchJsonSwr } from "../../../lib/data/swrCache.js";

    let hidden = $state(false);
    let repo = $state("—");
    let message = $state("Loading latest commit…");
    let meta = $state("—");
    let widgetHref = $state("https://github.com/maxeisen");
    let weeks = $state(null);
    let total = $state("—");
    let range = $state("—");
    let pollTimer;

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

    // SWR: a re-mount serves the cached payload instantly; the 5-min poll runs
    // past the 60s cache window so it still revalidates on cadence.
    async function load() {
        try {
            const data = await fetchJsonSwr("/.netlify/functions/githubLatest", {
                maxAgeMs: 60_000,
                onRevalidate: apply,
            });
            apply(data);
        } catch (e) {
            if (e instanceof FetchError && e.status === 503) { hidden = true; return; }
            message = "GitHub unavailable";
            meta = "";
        }
    }

    onMount(() => {
        load();
        pollTimer = setInterval(load, 1000 * 60 * 5);
    });
    onDestroy(() => clearInterval(pollTimer));
</script>

{#if !hidden}
    <a class="profile-link" href="https://github.com/maxeisen" target="_blank" rel="noreferrer">GitHub ↗</a>
    <a class="github-main" href={widgetHref} target="_blank" rel="noreferrer">
        <div class="widget-label">Code Activity</div>
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
        text-decoration: none;
        color: inherit;
    }
    .github-main :global(*) { text-decoration: none; }
    .github-repo {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-size: clamp(1rem, 1.25vw, 1.4rem);
        color: var(--header-colour);
        letter-spacing: -0.02em;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        flex-shrink: 0;
    }
    .github-message {
        font-size: clamp(0.8rem, 0.95vw, 1.05rem);
        color: var(--paragraph-colour);
        opacity: 0.85;
        margin-top: 0.3rem;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        flex-shrink: 0;
    }
    .github-meta {
        font-size: clamp(0.72rem, 0.85vw, 0.92rem);
        color: var(--paragraph-colour);
        opacity: 0.6;
        margin-top: 0.3rem;
        flex-shrink: 0;
    }
    .github-heatmap-wrap {
        display: flex;
        align-items: stretch;
        gap: 0.4rem;
        margin-top: 0.75rem;
        padding-top: 0.6rem;
        flex: 1 1 0;
        min-height: 60px;
        min-width: 0;
        overflow: hidden;
    }
    .github-heatmap-rows {
        display: grid;
        grid-template-rows: repeat(7, 1fr);
        gap: 2px;
        font-size: clamp(0.55rem, 0.7vw, 0.78rem);
        font-weight: 600;
        color: var(--paragraph-colour);
        opacity: 0.55;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        flex: 0 0 auto;
    }
    .github-heatmap-rows span {
        display: flex;
        align-items: center;
        line-height: 1;
    }
    .github-heatmap {
        display: grid;
        grid-auto-flow: column;
        grid-template-rows: repeat(7, minmax(0, 1fr));
        gap: 2px;
        flex: 1 1 0;
        min-width: 0;
        height: 100%;
    }
    .github-cell {
        border-radius: 2px;
        background: var(--main-green-translucent);
        opacity: 0.35;
        min-width: 0;
        min-height: 0;
    }
    .github-cell.l1 { opacity: 0.55; background: var(--main-green); }
    .github-cell.l2 { opacity: 0.7;  background: var(--main-green); }
    .github-cell.l3 { opacity: 0.85; background: var(--main-green); }
    .github-cell.l4 { opacity: 1;    background: var(--main-green); }
    .github-cell.future { opacity: 0.12; }
    .github-cell.today { box-shadow: inset 0 0 0 1.5px var(--header-colour); opacity: 1; }
    .github-graph-meta {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-top: 0.5rem;
        font-size: clamp(0.7rem, 0.85vw, 0.9rem);
        color: var(--paragraph-colour);
        opacity: 0.7;
        flex-shrink: 0;
    }
    .github-graph-total {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        color: var(--header-colour);
        font-size: clamp(0.95rem, 1.15vw, 1.25rem);
        opacity: 1;
    }
</style>
