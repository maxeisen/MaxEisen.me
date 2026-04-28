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
    import PassGenerator from './components/PassGenerator.svelte';
    import CursorSpotlight from './components/CursorSpotlight.svelte';

    var screenSize = window.matchMedia("(min-width: 860px)");
    let pathname = $state(typeof window !== 'undefined' ? window.location.pathname : '');
    if (typeof window !== 'undefined') {
        window.addEventListener('popstate', () => { pathname = window.location.pathname; });
    }
</script>

{#if pathname === '/pass-generator'}
    <PassGenerator />
{:else}
<CursorSpotlight />
<ThemeToggle />
<ModalProvider>
    {#if (screenSize.matches)}
        <MenuBar/>
    {/if}
    <div class="grid-container">
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
    </div>
</ModalProvider>
{/if}