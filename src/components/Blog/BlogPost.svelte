<!--
    /blog/<slug> — one post as a page of its own (it used to open in a modal
    on the homepage). The file is public/content/blog/<slug>.md: details in
    its front matter, then the Markdown text, rendered with marked.

    App.svelte remounts this for each post URL, so the slug is read once.
    A slug with no post goes to the 404 page, like any unknown path.
-->
<script>
    import { onMount } from "svelte";
    import { marked } from "marked";
    import SiteNav from "../../lib/ui/SiteNav.svelte";
    import Spinner from "../../lib/ui/Spinner.svelte";
    import { externalizeLinks } from "../../lib/ui/externalLinks.js";
    import { findPost, neighbours, loadPostBody, slugFromPath, formatDate, readingMinutes } from "./lib/posts.js";

    const slug = slugFromPath(window.location.pathname);
    const post = slug ? findPost(slug) : null;
    const { newer, older } = neighbours(slug);

    let html = $state("");
    let minutes = $state(null);
    let failed = $state(false);

    // Lazy-load images below the first screen; posts can carry a lot of them.
    const lazyImages = (s) => s.replace(/<img /g, '<img loading="lazy" decoding="async" ');

    onMount(async () => {
        if (!post) {
            window.location.replace("/404.html");
            return;
        }
        try {
            const source = await loadPostBody(post.slug);
            if (source == null) throw new Error(`No Markdown file for ${post.slug}`);
            minutes = readingMinutes(source);
            html = lazyImages(externalizeLinks(marked.parse(source)));
        } catch (err) {
            console.error(err);
            failed = true;
        }
    });
</script>

<svelte:head>
    {#if post}
        <title>{post.title} — Max Eisen</title>
        <meta name="description" content={post.description} />
    {/if}
    <meta name="robots" content="noindex" />
</svelte:head>

<SiteNav />

{#if post}
    <main class="post-page">
        <a class="back" href="/blog">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H3M7 4 3 8l4 4" /></svg>
            All posts
        </a>

        <header class="post-head">
            <p class="kicker">
                <time datetime={post.date}>{formatDate(post.date)}</time>{#if minutes}{" · "}{minutes} min read{/if}
            </p>
            <h1>{post.title}</h1>
            {#if post.description}<p class="lede">{post.description}</p>{/if}
            {#if post.updated}
                <p class="updated">Updated <time datetime={post.updated}>{formatDate(post.updated)}</time></p>
            {/if}
        </header>

        {#if post.note}
            <p class="note">{post.note}</p>
        {/if}

        {#if html}
            <article class="prose">{@html html}</article>
            <p class="sign-off">— Max</p>
        {:else if failed}
            <p class="status">This post didn't load. Try refreshing the page.</p>
        {:else}
            <div class="status" role="status" aria-label="Loading"><Spinner size={20} stroke={2} /></div>
        {/if}

        {#if newer || older}
            <nav class="more" aria-label="More posts">
                {#if older}
                    <a class="more-link" href="/blog/{older.slug}">
                        <span class="kicker">Older</span>
                        <span class="more-title">{older.title}</span>
                    </a>
                {:else}<span></span>{/if}
                {#if newer}
                    <a class="more-link next" href="/blog/{newer.slug}">
                        <span class="kicker">Newer</span>
                        <span class="more-title">{newer.title}</span>
                    </a>
                {/if}
            </nav>
        {/if}
    </main>
{/if}

<style>
    /* One reading column, about 70 characters wide. */
    .post-page {
        max-width: 720px;
        margin: 0 auto;
        padding: var(--space-6) var(--page-gutter) var(--space-8);
    }

    .back {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-6);
        font-size: var(--font-sm);
        font-weight: var(--weight-medium);
        color: var(--text-2);
    }
    .back:hover { color: var(--text-strong); }
    .back svg {
        width: 14px;
        height: 14px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .post-head {
        padding-bottom: var(--space-6);
        margin-bottom: var(--space-6);
        border-bottom: 1px solid var(--border);
    }
    .post-head .kicker { margin-bottom: var(--space-3); }
    h1 {
        margin: 0;
        font-size: var(--font-3xl);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.03em;
        line-height: 1.05;
        color: var(--text-strong);
        text-wrap: balance;
    }
    .lede {
        margin: var(--space-4) 0 0;
        font-size: var(--font-lg);
        line-height: var(--leading);
        color: var(--text-2);
        text-wrap: pretty;
    }
    .updated {
        margin: var(--space-3) 0 0;
        font-size: var(--font-xs);
        color: var(--text-3);
    }

    /* An aside from today about an older post, set apart from its text. */
    .note {
        margin: 0 0 var(--space-6);
        padding: var(--space-3) var(--space-4);
        border-left: 3px solid var(--border-strong);
        border-radius: 0 var(--radius) var(--radius) 0;
        background: var(--surface-2);
        font-size: var(--font-sm);
        line-height: var(--leading);
        color: var(--text-2);
    }

    .status {
        display: flex;
        justify-content: center;
        padding: var(--space-8) 0;
        color: var(--text-2);
        font-size: var(--font-sm);
    }

    /* The post body. Everything here is marked's output, so it's styled by
       element under .prose rather than with classes. */
    .prose {
        font-size: 1.0625rem;
        line-height: 1.75;
        color: var(--text);
        overflow-wrap: break-word;
    }
    .prose :global(> :first-child) { margin-top: 0; }
    .prose :global(p),
    .prose :global(ul),
    .prose :global(ol),
    .prose :global(blockquote),
    .prose :global(pre) { margin: 0 0 1.25em; }
    .prose :global(h2),
    .prose :global(h3) {
        margin: 2em 0 0.6em;
        color: var(--text-strong);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.015em;
        line-height: var(--leading-tight);
        scroll-margin-top: calc(var(--nav-height) + var(--space-4));
    }
    .prose :global(h2) { font-size: var(--font-xl); }
    .prose :global(h3) { font-size: var(--font-lg); }
    .prose :global(strong) { color: var(--text-strong); font-weight: var(--weight-semibold); }
    .prose :global(a) {
        color: var(--text-strong);
        text-decoration: underline;
        text-decoration-color: var(--border-strong);
        text-underline-offset: 0.2em;
        transition: text-decoration-color var(--dur-fast) var(--ease);
    }
    .prose :global(a:hover) { text-decoration-color: currentColor; }
    .prose :global(ul),
    .prose :global(ol) { padding-left: 1.4em; }
    .prose :global(li + li) { margin-top: 0.35em; }
    .prose :global(li::marker) { color: var(--text-3); }
    .prose :global(blockquote) {
        padding-left: var(--space-4);
        border-left: 3px solid var(--accent);
        color: var(--text-2);
    }
    .prose :global(code) {
        padding: 0.1em 0.35em;
        border-radius: var(--radius-sm);
        background: var(--surface-2);
        font-family: var(--font-mono);
        font-size: 0.88em;
    }
    .prose :global(pre) {
        padding: var(--space-4);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        overflow-x: auto;
        line-height: 1.55;
    }
    .prose :global(pre code) { padding: 0; background: none; font-size: var(--font-sm); }
    .prose :global(img) {
        display: block;
        max-width: 100%;
        height: auto;
        margin: var(--space-6) auto;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface-2);
    }
    .prose :global(hr) {
        margin: var(--space-7) 0;
        border: 0;
        border-top: 1px solid var(--border);
    }

    .sign-off {
        margin: var(--space-6) 0 0;
        font-size: var(--font-lg);
        font-weight: var(--weight-medium);
        color: var(--text-strong);
    }

    /* Older on the left, newer on the right, as two cards. */
    .more {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-3);
        margin-top: var(--space-7);
        padding-top: var(--space-6);
        border-top: 1px solid var(--border);
    }
    .more-link {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-4);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        transition: background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
    }
    .more-link:hover { background: var(--surface-2); border-color: var(--border-strong); }
    .more-link.next { grid-column: 2; text-align: right; }
    .more-title {
        font-size: var(--font-sm);
        font-weight: var(--weight-semibold);
        color: var(--text-strong);
    }

    @media (max-width: 620px) {
        .prose { font-size: var(--font-md); line-height: 1.7; }
        .lede { font-size: var(--font-md); }
        .more { grid-template-columns: 1fr; }
        .more > span:empty { display: none; }
        .more-link.next { grid-column: auto; text-align: left; }
    }
</style>
