<script>
    var isSafari = window.safari !== undefined;
    window.onscroll = function() {scrollFunction()};
    function scrollFunction() {
        if (document.body.scrollTop > 70 || document.documentElement.scrollTop > 70) {
            document.getElementById("nav-bar").style.fontSize = "20px";
            document.getElementById("nav-bar-list").style.backgroundColor = "rgba(18, 18, 18, 0.9)";
            document.getElementById("nav-bar-list").style.backdropFilter = "blur(3px)";
        }
        else {
            document.getElementById("nav-bar").style.fontSize = "30px";
            document.getElementById("nav-bar-list").style.backgroundColor = "rgba(18, 18, 18, 0)";
        }
    }
</script>

<div class="header-container">
    <header id="header">
        <div>
            <a href="/#" aria-label="Home" onclick=toggleTheme()>
                <img class="home-icon-mobile" src='./img/additional/memoji_cycle_small.gif' width="75px" height="88px" alt="Memoji gif for mobile">
                <video class="home-icon" poster='./img/additional/memoji_cycle_small.gif' autoplay loop muted playsinline>  
                    {#if !isSafari}
                        <source id="icon-video-webm" src='./img/additional/memoji_cycle.webm' type="video/webm">
                        <source id="icon-video-mp4" src='./img/additional/memoji_cycle.mp4' type="video/mp4">
                    {/if}
                </video>
            </a>
        </div>
        <div class="nav-bar" id="nav-bar">
            <nav>
                <ul class="nav-bar-list" id="nav-bar-list">
                    <li id="nav-bar-item"><a href="#experience">Experience</a></li>
                    <li id="nav-bar-item"><a href="#projects">Projects</a></li>
                    <li id="nav-bar-item"><a href="#blog">Blog</a></li>
                    <li id="nav-bar-item"><a href="#education">Education</a></li>
                    <li id="nav-bar-item"><a href="#skills">Skills</a></li>
                    <li id="nav-bar-item"><a href="/resume"><b>Resume</b></a></li>
                </ul>
            </nav>
        </div>
    </header>
</div>
