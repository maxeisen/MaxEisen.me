<!--
    Top 6 Hacker News stories. Story count is trimmed dynamically by
    trimListToFit so partial rows aren't shown when the container shrinks.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import { trimListToFit } from "../lib/utils.js";
    import { fetchJsonSwr } from "../../../lib/data/swrCache.js";
    import { createPoller } from "../../../lib/data/poller.js";
    import { bindTrimOnResize } from "../lib/listResize.js";
    import { listLoadState, listStateMessage } from "../lib/listState.js";
    import WidgetHeader from "./WidgetHeader.svelte";

    let listEl = $state();
    let stories = $state(null); // null = loading, [] = empty/error
    let stopPoll;
    let stopResizeTrim;

    function hostnameOf(url) {
        try { return new URL(url).hostname.replace(/^www\./, ""); }
        catch { return null; }
    }
    const storiesState = $derived(listLoadState(stories));
    const storiesMessage = $derived(listStateMessage(storiesState, "Loading…", "Unavailable"));

    const HN_MAX_AGE_MS = 1000 * 60 * 5;

    async function load() {
        try {
            const ids = (await fetchJsonSwr("https://hacker-news.firebaseio.com/v0/topstories.json", { maxAgeMs: HN_MAX_AGE_MS })).slice(0, 6);
            const items = await Promise.all(
                ids.map((id) => fetchJsonSwr(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { maxAgeMs: HN_MAX_AGE_MS })),
            );
            stories = items.filter(Boolean);
            requestAnimationFrame(() => trimListToFit(listEl));
        } catch {
            stories = [];
        }
    }

    onMount(() => {
        load();
        stopPoll = createPoller(load, 1000 * 60 * 5, { jitterMs: 15_000 });
        stopResizeTrim = bindTrimOnResize(listEl);
    });
    onDestroy(() => {
        stopPoll?.();
        stopResizeTrim?.();
    });
</script>

<WidgetHeader profileHref="https://news.ycombinator.com/" profileLabel="HN" label="Hacker News" />
<ol class="hn-list" bind:this={listEl}>
    {#if storiesMessage}
        <li class="widget-empty">{storiesMessage}</li>
    {:else}
        {#each stories as s (s.id)}
            {@const href = s.url || `https://news.ycombinator.com/item?id=${s.id}`}
            {@const domain = s.url ? hostnameOf(s.url) : "news.ycombinator.com"}
            <li class="hn-item">
                <span class="hn-score" title={`${s.score || 0} upvotes`}>{s.score || 0}</span>
                <a class="hn-link" href={href} target="_blank" rel="noreferrer">
                    <span class="hn-title">{s.title || "—"}</span>
                    {#if domain}<span class="hn-domain">{domain}</span>{/if}
                </a>
            </li>
        {/each}
    {/if}
</ol>

<style>
    .hn-list {
        list-style: none;
        padding: 0;
        margin: 0.25rem 0 0 0;
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }
    .hn-item {
        display: flex;
        gap: 0.5rem;
        font-size: 0.82rem;
        align-items: flex-start;
    }
    .hn-link {
        color: var(--paragraph-colour);
        text-decoration: none;
        line-height: 1.3;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;
        flex: 1;
    }
    .hn-link:hover .hn-title { color: var(--main-green); }
    .hn-title {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .hn-domain {
        font-size: 0.68rem;
        color: var(--paragraph-colour);
        opacity: 0.55;
        text-transform: lowercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .hn-score {
        color: var(--main-green);
        font-weight: 600;
        min-width: 2.5rem;
        font-variant-numeric: tabular-nums;
        text-align: right;
        flex-shrink: 0;
        font-size: 0.78rem;
        padding-top: 0.1rem;
    }
    .hn-score::before {
        content: "▲";
        font-size: 0.6rem;
        margin-right: 0.15rem;
        opacity: 0.7;
    }
</style>
