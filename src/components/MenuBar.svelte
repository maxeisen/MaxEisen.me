<script>
    var screenSize = window.matchMedia("(min-width: 860px)")
    window.onscroll = function() {scrollFunction()};
    function scrollFunction() {
        if (screenSize.matches) {
            if (document.body.scrollTop > 70 || document.documentElement.scrollTop > 70) {
                document.getElementById("nav-bar").style.fontSize = "20px";
                document.getElementById("nav-bar-list").style.backgroundColor = "rgba(18, 18, 18, 0.8)";
            }
            else {
                document.getElementById("nav-bar").style.fontSize = "30px";
                document.getElementById("nav-bar-list").style.backgroundColor = "rgba(18, 18, 18, 0)";
            }
        }
    }
</script>

<div class="header-container">
    <header id="header">
        <div>
            <a href="/#">
                <video class="home-icon" poster="./img/additional/memoji_cycle_small.gif" autoplay loop muted playsinline>  
                    <source src='./img/additional/memoji_cycle.webm' type="video/webm">
                    <source src='./img/additional/memoji_cycle.mp4' type="video/mp4">
                </video>
            </a>
        </div>
        <div class="nav-bar" id="nav-bar">
            <nav>
                <ul class="nav-bar-list" id="nav-bar-list">
                    <li id="nav-bar-item"><a href="#experience">Experience</a></li>
                    <li id="nav-bar-item"><a href="#projects">Projects</a></li>
                    <li id="nav-bar-item"><a href="#education">Education</a></li>
                    <li id="nav-bar-item"><a href="#skills">Skills</a></li>
                    <li id="nav-bar-item"><a href="/resume"><b>Résumé</b></a></li>
                </ul>
            </nav>
        </div>
    </header>
</div>