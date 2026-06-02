<script>
    import { onMount, onDestroy } from "svelte";

    function scrollFunction() {
        const navBar = document.getElementById("nav-bar");
        const navBarList = document.getElementById("nav-bar-list");
        if (!navBar || !navBarList) return;

        if (document.body.scrollTop > 70 || document.documentElement.scrollTop > 70) {
            navBar.style.fontSize = "20px";
            navBarList.style.backgroundColor = "rgba(18, 18, 18, 0.9)";
            navBarList.style.backdropFilter = "blur(3px)";
        } else {
            navBar.style.fontSize = "30px";
            navBarList.style.backgroundColor = "rgba(18, 18, 18, 0)";
        }
    }

    onMount(() => {
        window.addEventListener("scroll", scrollFunction, { passive: true });
        scrollFunction();
    });

    onDestroy(() => {
        window.removeEventListener("scroll", scrollFunction);
    });
</script>

<div class="header-container">
    <header id="header">
        <div class="home-icon-container">
            <a href="/#" aria-label="Home" class="home-logo-link">
                <svg class="home-logo" viewBox="0 0 100 100" role="img" aria-label="Max Eisen">
                    <circle cx="50" cy="50" r="48" fill="var(--main-green)"/>
                    <text x="50" y="51"
                          font-family="Fraunces, 'Iowan Old Style', 'Times New Roman', serif"
                          font-weight="700"
                          font-size="44"
                          letter-spacing="-2"
                          text-anchor="middle"
                          dominant-baseline="central"
                          fill="var(--background-one)">ME</text>
                </svg>
            </a>
        </div>
        <div class="nav-bar" id="nav-bar">
            <nav>
                <ul class="nav-bar-list" id="nav-bar-list">
                    <!-- <li id="nav-bar-item"><a href="#intro">Intro</a></li> -->
                    <!-- <li id="nav-bar-item"><a href="#experience">Experience</a></li> -->
                    <!-- <li id="nav-bar-item"><a href="#projects">Projects</a></li> -->
                    <!-- <li id="nav-bar-item"><a href="#blog">Blog</a></li> -->
                    <!-- <li id="nav-bar-item"><a href="#foundations">Foundations</a></li> -->
                    <!-- <li id="nav-bar-item"><a href="#skills">Skills</a></li> -->
                    <li id="nav-bar-item"><a href="/gallery"><b>Photos</b></a></li>
                    <li id="nav-bar-item"><a href="/resume"><b>Resume</b></a></li>
                    <li id="nav-bar-item"><a href="/dashboard"><b>Dashboard</b></a></li>
                </ul>
            </nav>
        </div>
    </header>
</div>

<style>
    .home-logo {
        width: 80px;
        height: 80px;
        display: block;
        transition: transform 0.1s ease-in;
    }
    .home-logo:hover { transform: scale(1.15); }
    .home-logo:active { transform: scale(0.95); }
</style>
