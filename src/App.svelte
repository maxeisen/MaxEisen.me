<script>
    import ThemeToggle from './components/ThemeToggle.svelte';
    import MenuBar from './components/MenuBar.svelte';
    import Profile from './components/Profile.svelte';
    import Intro from './components/Intro.svelte';
    import Blog from './components/Blog.svelte';
    import Experience from './components/Experience.svelte';
    import Projects from './components/Projects.svelte';
    import Foundations from './components/Foundations.svelte';
    import Skills from './components/Skills.svelte';
    import Footer from './components/Footer.svelte';
    import ModalProvider from './components/ModalProvider.svelte';
    import CursorSpotlight from './components/CursorSpotlight.svelte';

    var screenSize = window.matchMedia("(min-width: 860px)");
    let pathname = $state(typeof window !== 'undefined' ? window.location.pathname : '');
    if (typeof window !== 'undefined') {
        window.addEventListener('popstate', () => { pathname = window.location.pathname; });
    }

    // === Lazy-loaded routes ============================================
    // Each entry is a loader function — Vite turns these dynamic imports
    // into separate chunks, so the homepage doesn't ship gallery code in
    // its initial bundle. Add a new route by appending to this table; no
    // other plumbing change required.
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
        // Race guard: only commit if the URL still matches when the module
        // resolves (otherwise a quick nav could land the wrong component).
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
<CursorSpotlight />
<ThemeToggle />
<ModalProvider>
    {#if (screenSize.matches)}
        <MenuBar/>
    {/if}
    <main class="grid-container">
        <div class="profile-section">
            <Profile/>
        </div>
        <div class="info-section-main">
            <div class="info-section-inner">
                <Intro/>
                <Experience/>
                <Projects/>
                <!-- <Blog/> -->
                <Foundations/>
                <Skills/>
            </div>
                <Footer/>
        </div>
    </main>
</ModalProvider>
{/if}