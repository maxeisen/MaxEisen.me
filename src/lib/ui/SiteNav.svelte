<!--
    The site's one navigation bar — on the homepage and every SPA route.

    Monogram + name on the left (home), section links on the right, the
    current one marked, then the theme toggle. Nothing page-specific goes in
    the row: a control only some pages have (like the layout Edit toggle,
    which floats on the page instead) would push the links over there.

    `sticky` keeps it pinned while a long page scrolls; the full-height
    dashboard turns that off because it never scrolls.

    `hideable` adds a control that tucks the bar away, leaving a small tab
    at the top edge to bring it back; the choice is remembered per page.
    Bind `hidden` to lay the page out for either state. The bar is always
    the same width on every page, so nothing shifts between routes — which
    is why the hide control sits outside the bar's layout instead of taking
    a place in the row (where it would push the links over on the pages
    that have it). It's a tab at the top-centre of the bar, the same spot as
    the tab that brings it back, so the bar can be put away and brought
    back without moving the pointer.

    The link list is the single place to add or rename a section.
-->
<script>
    import { onMount } from "svelte";
    import ThemeToggle from "./ThemeToggle.svelte";
    import Logo from "./Logo.svelte";

    let { sticky = true, hideable = false, hidden = $bindable(false) } = $props();

    const LINKS = [
        { href: "/resume", label: "Resume" },
        { href: "/gallery", label: "Photos" },
        { href: "/running", label: "Running" },
        { href: "/cycling", label: "Cycling" },
        { href: "/dashboard", label: "Dashboard" },
    ];

    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    const isCurrent = (href) => path === href || path.startsWith(`${href}/`);
    const storageKey = `nav-hidden:${path}`;

    onMount(() => {
        if (!hideable) return;
        try { hidden = localStorage.getItem(storageKey) === "1"; } catch {}
    });

    function setHidden(next) {
        hidden = next;
        try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch {}
    }
</script>

{#if hideable && hidden}
    <button class="reveal" type="button" onclick={() => setHidden(false)} aria-label="Show navigation" title="Show navigation">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
    </button>
{:else}
<header class="site-nav" class:sticky>
    <div class="inner">
        <a class="home" href="/" aria-label="Max Eisen — home">
            <Logo size={28} />
            <span class="name">Max Eisen</span>
        </a>

        <nav aria-label="Site">
            <ul>
                {#each LINKS as link (link.href)}
                    <li>
                        <a href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined}>{link.label}</a>
                    </li>
                {/each}
            </ul>
        </nav>

        <div class="tools">
            <ThemeToggle />
        </div>
    </div>
    <!-- Out of the row, at the top-centre: see .hide. -->
    {#if hideable}
        <button class="hide" type="button" onclick={() => setHidden(true)} aria-label="Hide navigation" title="Hide navigation">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 10l4-4 4 4" /></svg>
        </button>
    {/if}
</header>
{/if}

<style>
    .site-nav {
        position: relative;
        z-index: var(--z-sticky);
        background: var(--bg);
        border-bottom: 1px solid var(--border);
    }
    .site-nav.sticky {
        position: sticky;
        top: 0;
    }
    .inner {
        display: flex;
        align-items: center;
        gap: var(--space-5);
        max-width: var(--page-max);
        height: var(--nav-height);
        margin: 0 auto;
        padding: 0 var(--page-gutter);
    }

    .home {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        flex: none;
        color: var(--text-strong);
        font-weight: var(--weight-semibold);
        font-size: var(--font-sm);
        letter-spacing: -0.01em;
    }
    .home:hover { color: var(--text-strong); }

    nav {
        flex: 1;
        min-width: 0;
        display: flex;
        justify-content: flex-end;
    }
    ul {
        display: flex;
        gap: var(--space-1);
        margin: 0;
        padding: 0;
        list-style: none;
        overflow-x: auto;
        scrollbar-width: none;
    }
    ul::-webkit-scrollbar { display: none; }
    nav a {
        display: block;
        padding: 6px 10px;
        border-radius: var(--radius);
        font-size: var(--font-sm);
        font-weight: var(--weight-medium);
        color: var(--text-2);
        white-space: nowrap;
        transition: color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
    }
    nav a:hover { color: var(--text-strong); background: var(--surface-2); }
    nav a[aria-current="page"] { color: var(--text-strong); background: var(--surface-2); }

    .hide,
    .reveal {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        color: var(--text-2);
        cursor: pointer;
        transition: color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
    }
    /* Both tabs hang from the top edge at the centre, the same size, so
       hiding and showing the bar is one spot clicked twice. */
    .hide,
    .reveal {
        top: 0;
        left: 50%;
        width: 48px;
        height: 18px;
        transform: translateX(-50%);
        border: 1px solid var(--border);
        border-top: 0;
        border-radius: 0 0 var(--radius) var(--radius);
        background: var(--surface);
    }
    .hide { position: absolute; }
    .hide:hover { color: var(--text-strong); background: var(--surface-2); }
    /* While hidden, the tab hangs in the gutter above the content. */
    .reveal {
        position: fixed;
        z-index: var(--z-sticky);
    }
    .reveal:hover { color: var(--text-strong); height: 22px; }
    .hide svg, .reveal svg {
        width: 14px;
        height: 14px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    /* Narrower than this, a link sits under the bar's centre, 12px down.
       The tab slims to stay above it; it's still inside the top of the
       revealing tab, so the pointer needn't move. */
    @media (max-width: 1099px) {
        .hide { height: 10px; }
        .hide svg { width: 10px; height: 10px; }
    }

    .tools {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex: none;
    }

    @media (max-width: 700px) {
        .inner { gap: var(--space-3); }
        .name { display: none; }
        nav { justify-content: flex-start; }
        /* Fade the scrollable link row out at its edge so a cut-off link
           reads as "more this way" rather than as a bug. */
        ul {
            -webkit-mask-image: linear-gradient(to right, #000 85%, transparent);
            mask-image: linear-gradient(to right, #000 85%, transparent);
            padding-right: var(--space-5);
        }
        nav a { padding: 6px 8px; }
    }
</style>
