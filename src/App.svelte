<script>
	import Sidebar from './components/Sidebar.svelte';
	import Intro from './components/Intro.svelte';
	import Experience from './components/Experience.svelte';
    import Projects from './components/Projects.svelte';
    import Education from './components/Education.svelte';
    import Skills from './components/Skills.svelte';
  	import Modal from 'svelte-simple-modal';
    let memoji = "./img/headshots/memoji_cycle_large.gif";
</script>

<Modal>
<html lang="en">
    <body>
        <header>
            <div>
                <a href="/#"><img class="home-icon" type="image/gif" src={memoji} alt="Animated gif of Max memoji"/></a>
            </div>
            <div class="nav-bar">
                <nav>
                    <ul>
                        <li><a href="#experience">Experience</a></li>
                        <li><a href="#projects">Projects</a></li>
                        <li><a href="#education">Education</a></li>
                        <li><a href="#skills">Skills</a></li>
                        <li><a href="/resume"><b>Resume</b></a></li>
                    </ul>
                </nav>
            </div>
        </header>
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
                <a href="https://github.com/maxeisen/MaxEisen.me/"><h2 class="footer">Made at &#127968; by Max Eisen <b style="font-size:14px; color:#ababab">&copy;2020</b></h2></a>
            </div>
        </div>
    </body>
</html>
</Modal>