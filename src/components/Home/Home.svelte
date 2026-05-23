<!--
    Homepage. Renders the page chrome (cursor spotlight, theme toggle,
    modal context, menu bar on desktop) around the content sections.

    Imports are grouped by subfolder:
      - layout/   page-shell pieces (overlays, nav, providers)
      - sections/ the actual content blocks rendered in the grid
-->
<script>
    import CursorSpotlight from './layout/CursorSpotlight.svelte';
    import ThemeToggle from './layout/ThemeToggle.svelte';
    import ModalProvider from './layout/ModalProvider.svelte';
    import MenuBar from './layout/MenuBar.svelte';

    import Profile from './sections/Profile.svelte';
    import Intro from './sections/Intro.svelte';
    import Experience from './sections/Experience.svelte';
    import Projects from './sections/Projects.svelte';
    import Foundations from './sections/Foundations.svelte';
    import Skills from './sections/Skills.svelte';
    import Footer from './sections/Footer.svelte';
    // Blog kept here intentionally — wired in once it's ready to surface.
    // import Blog from './sections/Blog.svelte';

    const screenSize = window.matchMedia("(min-width: 860px)");
</script>

<CursorSpotlight />
<ThemeToggle />
<ModalProvider>
    {#if screenSize.matches}
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
