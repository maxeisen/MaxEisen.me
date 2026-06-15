<!--
    App shell / router. Each route in ROUTES lazy-loads its component as a
    separate Vite chunk; the homepage renders for "/" and any unknown path.

    Navigation is client-side: same-origin links to the homepage or a known
    route are intercepted and handled with pushState + a component swap, so
    there's no full document reload (no re-downloading the shell + bundle,
    no white flash). Anything not client-navigable — the static /resume
    page, the stateful /bach route, hash/anchor links, external links,
    modified clicks, downloads — falls through to a normal browser load.

    Loading state: while a known route's chunk downloads we show a minimal
    spinner (after a 150ms delay so cached/fast loads show nothing) — never
    the homepage, which is what previously flashed as a half-mounted page.

    Route chunks are prefetched on hover/focus/touch so the chunk is usually
    cached before the click — most client-side navigations are instant.
-->
<script>
    import { onMount } from 'svelte';
    import { cubicOut } from 'svelte/easing';
    import Home from './components/Home/Home.svelte';
    import Spinner from './lib/ui/Spinner.svelte';

    let pathname = $state(typeof window !== 'undefined' ? window.location.pathname : '');

    const ROUTES = {
        '/gallery':       () => import('./routes/Gallery.svelte'),
        '/gallery/ride':  () => import('./routes/GalleryRide.svelte'),
        '/gallery/run':   () => import('./routes/GalleryRun.svelte'),
        '/dashboard':     () => import('./routes/Dashboard.svelte'),
        '/toronto':       () => import('./routes/Toronto.svelte'),
        '/bach':          () => import('./routes/Bach.svelte'),
    };

    // Routes that exist in ROUTES (so they lazy-load + show the loader) but
    // are deliberately NOT client-side-navigated via link clicks: /bach
    // reads window.location at component init and is stateful, so a clean
    // full load is safer than an in-place mount.
    const NO_CLIENT_NAV = new Set(['/bach']);

    const isRoute = $derived(pathname in ROUTES);

    // === page transitions ==============================================
    // Pure opacity cross-fade — no transform, so it's safe across both
    // normal-flow pages and the fixed full-viewport routes (dashboard,
    // toronto) without any special-casing. Svelte's mount() defaults to
    // intro:false, so this plays on client-side navigation but NOT on the
    // initial page load (no first-paint delay).
    const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function pageIn() {
        return { duration: prefersReduced ? 100 : 200, easing: cubicOut, css: (t) => `opacity: ${t}` };
    }
    function pageOut() {
        return { duration: prefersReduced ? 60 : 150, css: (t) => `opacity: ${t}` };
    }

    let RouteComponent = $state(null);
    $effect(() => {
        const loader = ROUTES[pathname];
        if (!loader) {
            RouteComponent = null;
            return;
        }
        const requestedPath = pathname;
        loader().then((mod) => {
            // Race guard: only commit if the URL still matches when the
            // chunk resolves (a fast back/forward could have moved on).
            if (window.location.pathname === requestedPath) {
                RouteComponent = mod.default;
            }
        }).catch((err) => {
            console.error('Failed to load route', pathname, err);
            RouteComponent = null;
        });
    });

    // Delay the spinner so a cached/fast chunk load shows nothing (no
    // spinner flash); only a genuinely slow load reveals it.
    let showSpinner = $state(false);
    $effect(() => {
        if (isRoute && !RouteComponent) {
            showSpinner = false;
            const t = setTimeout(() => { showSpinner = true; }, 150);
            return () => clearTimeout(t);
        }
        showSpinner = false;
    });

    // === client-side navigation =========================================

    function navigate(href) {
        const url = new URL(href, window.location.origin);
        if (url.pathname === window.location.pathname && url.search === window.location.search && !url.hash) {
            return; // already here, nothing to do
        }
        window.history.pushState({}, '', url.href);
        pathname = url.pathname;
        if (url.hash) {
            // Let the destination render, then jump to the anchor.
            requestAnimationFrame(() => {
                const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
                if (el) el.scrollIntoView();
                else window.scrollTo(0, 0);
            });
        } else {
            window.scrollTo(0, 0);
        }
    }

    function onDocumentClick(e) {
        // Bail on anything that isn't a plain primary-button click.
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = e.target.closest?.('a[href]');
        if (!a) return;
        if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
        if ((a.getAttribute('rel') || '').split(/\s+/).includes('external')) return;

        let url;
        try { url = new URL(a.href, window.location.origin); } catch { return; }
        if (url.origin !== window.location.origin) return;

        // Same page (anchor links like #section, the "/#" home logo,
        // query-only changes) → leave entirely to the browser.
        if (url.pathname === window.location.pathname) return;

        // Only the homepage + known SPA routes are client-navigable. Static
        // pages (/resume) and excluded routes (/bach) full-load normally.
        const navigable =
            (url.pathname === '/' || url.pathname in ROUTES) && !NO_CLIENT_NAV.has(url.pathname);
        if (!navigable) return;

        e.preventDefault();
        navigate(url.href);
    }

    // === route chunk prefetch on intent =================================
    // import() is deduped by the browser, so the later load() in the route
    // $effect resolves instantly. Warms the HTTP + SW cache.
    const prefetched = new Set();
    function onLinkIntent(e) {
        const a = e.target.closest?.('a[href]');
        if (!a) return;
        let url;
        try { url = new URL(a.href, window.location.origin); } catch { return; }
        if (url.origin !== window.location.origin) return;
        if (prefetched.has(url.pathname)) return;
        const loader = ROUTES[url.pathname];
        if (!loader) return;
        prefetched.add(url.pathname);
        loader();
    }

    onMount(() => {
        window.addEventListener('popstate', () => { pathname = window.location.pathname; });
        document.addEventListener('click', onDocumentClick);
        document.addEventListener('pointerover', onLinkIntent);
        document.addEventListener('focusin', onLinkIntent);
        document.addEventListener('touchstart', onLinkIntent, { passive: true });
        return () => {
            document.removeEventListener('click', onDocumentClick);
            document.removeEventListener('pointerover', onLinkIntent);
            document.removeEventListener('focusin', onLinkIntent);
            document.removeEventListener('touchstart', onLinkIntent);
        };
    });

    // Fire a GA page_view on every in-SPA navigation. The initial pageview
    // for the document is already sent by the gtag('config', …) call in
    // index.html, so we skip the first $effect run; only subsequent
    // pathname changes (link nav + back/forward) need the explicit event.
    // Defers via a microtask so document.title can update from the route's
    // <svelte:head> before we send.
    let pageViewFired = false;
    $effect(() => {
        pathname; // track changes
        if (!pageViewFired) { pageViewFired = true; return; }
        if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
        queueMicrotask(() => {
            window.gtag('event', 'page_view', {
                page_path: pathname,
                page_location: window.location.href,
                page_title: document.title,
            });
        });
    });
</script>

<!--
    Each navigation re-keys this block, so the leaving page plays `out` and
    the entering page plays `in`. The grid-stack overlaps them in one cell
    so they cross-fade without a layout/scroll jump.
-->
<div class="page-stack">
    {#key pathname}
        <div class="page" in:pageIn out:pageOut>
            {#if isRoute}
                {#if RouteComponent}
                    <RouteComponent />
                {:else if showSpinner}
                    <div class="route-loading" role="status" aria-label="Loading" aria-busy="true">
                        <Spinner size={38} stroke={3} />
                    </div>
                {/if}
            {:else}
                <Home />
            {/if}
        </div>
    {/key}
</div>

<style>
    /* Overlap the leaving + entering pages in a single grid cell so the
       cross-fade has no layout shift / scroll jump. Fixed-layout routes
       escape the grid (position:fixed) and overlap the viewport directly;
       normal-flow pages share the cell. */
    .page-stack { display: grid; }
    .page-stack > .page {
        grid-area: 1 / 1;
        min-width: 0;
    }

    /* Neutral full-viewport loading state on the site's base background —
       deliberately content-free so there's nothing to "half-load". */
    .route-loading {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--background-one);
        z-index: 1;
    }
</style>
