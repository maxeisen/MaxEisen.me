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
</script>

{#if RouteComponent}
    <RouteComponent />
{:else}
    <Home />
{/if}
