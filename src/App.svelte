<script>
    // import ThemeToggle from './components/ThemeToggle.svelte'
    import MenuBar from './components/MenuBar.svelte';
    import Sidebar from './components/Sidebar.svelte';
    import Intro from './components/Intro.svelte';
    import Blog from './components/Blog.svelte';
    import Experience from './components/Experience.svelte';
    import Projects from './components/Projects.svelte';
    import Education from './components/Education.svelte';
    import Skills from './components/Skills.svelte';
    import Footer from './components/Footer.svelte';
    import Modal from 'svelte-simple-modal';
</script>

<Modal>
    <!-- <ThemeToggle on:change="{toggleTheme()}"/> -->
    <MenuBar/>
    <div class="grid-container">
        <div class="sidebar-section">
            <Sidebar/>
        </div>
        <div class="info-section-main">
            <div class="info-section-inner">
                <Intro/>
                <Blog/>
                <Experience/>
                <Projects/>
                <Education/>
                <Skills/>
            </div>
                <Footer/>
        </div>
    </div>
</Modal>