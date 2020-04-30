<script>
	import Sidebar from './components/Sidebar.svelte';
	import Intro from './components/Intro.svelte';
	import Experience from './components/Experience.svelte';
    import Projects from './components/Projects.svelte';
	import Skills from './components/Skills.svelte';
    import Education from './components/Education.svelte';
  	import Modal from 'svelte-simple-modal';

	let memoji = "./img/headshots/memoji_cycle_large.gif";
</script>

<Modal>
<html lang="en">

<body>

    <header>
        <div>
            <a href="https://maxeisen.me"><img class="home-icon" type="image/gif" src={memoji} alt="Animated gif of Max memoji"/></a>
        </div>
        <div class="nav-bar">
            <nav>
                <ul>
                    <li><a href="#experience">Experience</a></li>
                    <li><a href="#projects">Projects</a></li>
                    <li><a href="#skills">Skills</a></li>
                    <li><a href="#education">Education</a></li>
                    <li><a href="/resume"><b>Resume</b></a></li>
                </ul>
            </nav>
        </div>
    </header>

    <div class="grid-container">

        <div class="sidebar-section">
			<Sidebar/>
        </div>

        <div class="info-section">
            <Intro/>

			<Experience/>

            <Projects/>

            <Skills/>

            <Education/>
        </div>

    </div>

    <a href="https://github.com/maxeisen/maxeisen.github.io/"><h2 class="footer">Made at &#127968; by Max Eisen <b style="font-size:14px; color:#ababab">&copy;2020</b></h2></a>

</body>

</html>
</Modal>