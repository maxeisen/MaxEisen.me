<!--
    App shell. Acts as the router: each route in ROUTES lazy-loads its
    component as a separate Vite chunk; everything else falls through to
    the homepage. Race-guard ensures slow chunks arriving after a quick
    navigation don't render the wrong page.
-->
<script>
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
    };

    let RouteComponent = $state(null);
    $effect(() => {
        const loader = ROUTES[pathname];
        if (!loader) {
            RouteComponent = null;
            return;
        }
        const requestedPath = pathname;
        loader().then((mod) => {
            if (window.location.pathname === requestedPath) {
                RouteComponent = mod.default;
            }
        }).catch((err) => {
            console.error('Failed to load route', pathname, err);
            RouteComponent = null;
        });
    });

    // Fire a GA page_view on every in-SPA navigation. The initial pageview
    // for the document is already sent by the gtag('config', …) call in
    // index.html, so we skip the first $effect run; only subsequent
    // pathname changes (back/forward, programmatic navigation) need the
    // explicit event. Defers via a microtask so document.title has the
    // chance to update from the new route's <svelte:head> before we send.
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

{#if RouteComponent}
    <RouteComponent />
{:else}
    <Home />
{/if}
