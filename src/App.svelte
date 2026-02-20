<script>
    // import ThemeToggle from './components/ThemeToggle.svelte'
    import MenuBar from './components/MenuBar.svelte';
    import Profile from './components/Profile.svelte';
    import Intro from './components/Intro.svelte';
    import Blog from './components/Blog.svelte';
    import Experience from './components/Experience.svelte';
    import Projects from './components/Projects.svelte';
    import Education from './components/Education.svelte';
    import Skills from './components/Skills.svelte';
    import Footer from './components/Footer.svelte';
    import ModalProvider from './components/ModalProvider.svelte';

    var screenSize = window.matchMedia("(min-width: 860px)")
</script>

<ModalProvider>
    <!-- <ThemeToggle on:change="{toggleTheme()}"/> -->
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
                <Blog/>
                <Education/>
                <Skills/>
            </div>
                <Footer/>
        </div>
    </div>
</ModalProvider>