<!--
    /blog — the list of posts. Each row links to the post's own page at
    /blog/<slug>. The list is built from each post's front matter
    (public/content/blog/*.md).

    Not in the site nav yet (see LINKS in SiteNav) and marked noindex, so it
    is only reachable by URL until it's ready to show.
-->
<script>
    import SiteNav from "../../lib/ui/SiteNav.svelte";
    import PageHeader from "../../lib/ui/PageHeader.svelte";
    import { listPosts, formatDate } from "./lib/posts.js";

    const posts = listPosts();
</script>

<svelte:head>
    <title>Blog — Max Eisen</title>
    <meta name="description" content="Writing by Max Eisen on building this site, design, and whatever else." />
    <meta name="robots" content="noindex" />
</svelte:head>

<SiteNav />

<main class="blog-page">
    <PageHeader kicker="Writing" title="Blog" subtitle="Notes on building this site, design, and whatever else is on my mind." />

    {#if posts.length}
        <ol class="posts">
            {#each posts as post (post.slug)}
                <li>
                    <a class="post" href="/blog/{post.slug}">
                        <time class="date num" datetime={post.date}>{formatDate(post.date, { short: true })}</time>
                        <span class="text">
                            <span class="title">{post.title}</span>
                            <span class="desc">{post.description}</span>
                        </span>
                        <svg class="arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
                    </a>
                </li>
            {/each}
        </ol>
    {:else}
        <p class="empty">Nothing here yet.</p>
    {/if}
</main>

<style>
    .blog-page {
        max-width: 860px;
        margin: 0 auto;
        padding: var(--space-7) var(--page-gutter) var(--space-8);
    }

    .posts {
        margin: 0;
        padding: 0;
        list-style: none;
        border-top: 1px solid var(--border);
    }
    .posts li { border-bottom: 1px solid var(--border); }

    /* Date in a fixed column on the left so titles line up; the arrow
       slides in on hover to say the row opens something. */
    .post {
        display: grid;
        grid-template-columns: 7.5rem minmax(0, 1fr) auto;
        align-items: baseline;
        gap: var(--space-4);
        padding: var(--space-5) var(--space-3);
        margin: 0 calc(-1 * var(--space-3));
        border-radius: var(--radius);
        color: var(--text);
        transition: background var(--dur-fast) var(--ease);
    }
    .post:hover { background: var(--surface-2); color: var(--text); }
    .post:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

    .date {
        font-size: var(--font-xs);
        color: var(--text-3);
        white-space: nowrap;
    }
    .text { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
    .title {
        font-size: var(--font-lg);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.01em;
        line-height: var(--leading-tight);
        color: var(--text-strong);
    }
    .desc {
        font-size: var(--font-sm);
        line-height: var(--leading);
        color: var(--text-2);
    }
    .arrow {
        align-self: center;
        width: 16px;
        height: 16px;
        fill: none;
        stroke: var(--text-3);
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0;
        transform: translateX(-4px);
        transition: opacity var(--dur-fast) var(--ease), transform var(--dur) var(--ease);
    }
    .post:hover .arrow,
    .post:focus-visible .arrow { opacity: 1; transform: none; stroke: var(--text-strong); }

    .empty { color: var(--text-2); font-size: var(--font-sm); }

    /* On a phone the date moves above the title and the arrow goes. */
    @media (max-width: 620px) {
        .post {
            grid-template-columns: minmax(0, 1fr);
            gap: var(--space-2);
            padding: var(--space-4) var(--space-3);
        }
        .arrow { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
        .arrow { transform: none; transition: none; }
    }
</style>
