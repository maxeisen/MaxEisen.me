<script>
    let headshot = "./img/headshots/tight_headshot.png";
</script>

<h1>Maxwell Eisen</h1>
<h2 class="status">CS <b style="color: #ababab; font-weight: 300">@</b> Queen's University</h2>
<h2 class="location">Toronto, ON</h2>
<div class="social-links-container">
    <h2><a class="social-links" href="https://linkedin.com/in/maxeisen/" target="_blank">LinkedIn</a></h2>
    <h2><a class="social-links" href="https://github.com/maxeisen/" target="_blank">GitHub</a></h2>
    <h2><a class="social-links" href="https://twitter.com/maxeisen/" target="_blank">Twitter</a></h2>
    <h2><a class="social-links" href="mailto:max.eisen@queensu.ca" target="_blank">Email</a></h2>
</div>

<div class="headshot">
    <img class="headshot" src={headshot} alt="Tightly cropped picture of Max"/>
</div>

<style>
    .status {
        font-size: 22px;
        margin-top: -20px;
        margin-bottom: 20px;
        font-weight: 500;
    }

    .location {
        margin-top: -10px;
        margin-bottom: 20px;
        font-weight: 300;
    }

    .headshot {
        -webkit-transition: all 0.1s ease-in;
        -moz-transition: all 0.1s ease-in;
        -o-transition: all 0.1s ease-in;
        -ms-transition: all 0.1s ease-in;
        transition: all 0.1s ease-in;
        align-self: center;
        margin-left: auto;
        margin-right: auto;
        padding: 0;
        width: 200px;
        height: 200px;
        -webkit-filter: drop-shadow(2px -2px 2px #222);
        filter: drop-shadow(2px -2px 2px #222);
    }

    .headshot:hover {
        filter: brightness(1.02);
        width: 220px;
        height: 220px;
    }

    .social-links-container {
        margin-top: 30px;
    }

    .social-links {
        color: rgb(173, 222, 255);
        text-align: center;
        margin-left: auto;
        margin-right: auto;
    }

    a:hover {
    color: #00bba2;
}
</style>