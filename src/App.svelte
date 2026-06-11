<!--
    App shell / router. Each route in ROUTES lazy-loads its component as a
    separate Vite chunk; the homepage renders for "/" and any unknown path.

    Loading state: while a KNOWN route's chunk is still downloading we show
    a minimal loader — NOT the homepage. (Rendering <Home /> as the fallback
    was what caused a flash of a half-mounted homepage before the real route
    appeared.) A short delay before the spinner means fast/cached loads show
    nothing at all rather than a spinner flash.

    Perf: internal route links are prefetched on hover / focus / touch (event
    delegation on the document), so the chunk is usually already cached by
    the time the navigation happens.
-->
<script>
    import { onMount } from 'svelte';
    import Home from './components/Home/Home.svelte';

    let pathname = $state(typeof window !== 'undefined' ? window.location.pathname : '');
    if (typeof window !== 'undefined') {
        window.addEventListener('popstate', () => { pathname = window.location.pathname; });
    }

    const ROUTES = {
        '/gallery':       () => import('./routes/Gallery.svelte'),
        '/gallery/ride':  () => import('./routes/GalleryRide.svelte'),
        '/gallery/run':   () => import('./routes/GalleryRun.svelte'),
        '/dashboard':     () => import('./routes/Dashboard.svelte'),
        '/toronto':       () => import('./routes/Toronto.svelte'),
        '/bach':          () => import('./routes/Bach.svelte'),
    };

    const isRoute = $derived(pathname in ROUTES);

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

    // Prefetch a route chunk on intent (hover / keyboard focus / touch).
    // import() is deduped by the browser, so the later load() in the
    // $effect resolves instantly. Warms the HTTP + SW cache so even a
    // full-page navigation finds the chunk already there.
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
        document.addEventListener('pointerover', onLinkIntent);
        document.addEventListener('focusin', onLinkIntent);
        document.addEventListener('touchstart', onLinkIntent, { passive: true });
        return () => {
            document.removeEventListener('pointerover', onLinkIntent);
            document.removeEventListener('focusin', onLinkIntent);
            document.removeEventListener('touchstart', onLinkIntent);
        };
    });

    // Fire a GA page_view on every in-SPA navigation. The initial pageview
    // for the document is already sent by the gtag('config', …) call in
    // index.html, so we skip the first $effect run; only subsequent
    // pathname changes (back/forward) need the explicit event. Defers via a
    // microtask so document.title can update from the route's <svelte:head>.
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

{#if isRoute}
    {#if RouteComponent}
        <RouteComponent />
    {:else if showSpinner}
        <div class="route-loading" role="status" aria-label="Loading" aria-busy="true">
            <div class="route-spinner" aria-hidden="true"></div>
        </div>
    {/if}
{:else}
    <Home />
{/if}

<style>
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
    .route-spinner {
        width: 38px;
        height: 38px;
        border: 3px solid var(--main-green-translucent, rgba(0, 128, 111, 0.2));
        border-top-color: var(--main-green, #00806f);
        border-radius: 50%;
        animation: route-spin 0.7s linear infinite;
    }
    @keyframes route-spin {
        to { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
        .route-spinner { animation-duration: 1.6s; }
    }
</style>
