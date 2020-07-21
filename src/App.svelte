<script>
    import MenuBar from './components/MenuBar.svelte';
    import Sidebar from './components/Sidebar.svelte';
    import Intro from './components/Intro.svelte';
    import Experience from './components/Experience.svelte';
    import Projects from './components/Projects.svelte';
    import Education from './components/Education.svelte';
    import Skills from './components/Skills.svelte';
    import Footer from './components/Skills.svelte';
    import Modal from 'svelte-simple-modal';
</script>

<Modal>
    <MenuBar/>
    <div class="grid-container">
        <div class="sidebar-section">
            <Sidebar/>
        </div>
        <div class="info-section-main">
            <div class="info-section-inner">
                <Intro/>
                <Experience/>
                <Projects/>
                <Education/>
                <Skills/>
            </div>
                <h2 class="footer"><a href="https://github.com/maxeisen/MaxEisen.me/" rel="noreferrer" class="footer">Made at &#127968; by Max Eisen <b style="font-size:14px; color:#ababab">&copy;2020</b></a></h2>
        </div>
    </div>
</Modal>
