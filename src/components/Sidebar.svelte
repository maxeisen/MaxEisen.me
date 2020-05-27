<script>
    let headshot = "./img/headshots/tight_headshot.png";
    import LinkedInLogo from 'svelte-icons/io/IoLogoLinkedin.svelte'
    import GitHubLogo from 'svelte-icons/io/IoLogoGithub.svelte'
    import TwitterLogo from 'svelte-icons/io/IoLogoTwitter.svelte'
    import MailIcon from 'svelte-icons/io/IoIosMail.svelte'
</script>

<h1>Maxwell Eisen</h1>
<h2 class="status">CS <b style="color: #ababab; font-weight: 300">@</b> Queen's University</h2>
<h2 class="location">Toronto, ON</h2>
<div class="social-links-container">
    <a class="social-links" href="https://linkedin.com/in/maxeisen/" target="_blank"><LinkedInLogo /></a>
    <a class="social-links" href="https://github.com/maxeisen/" target="_blank"><GitHubLogo /></a>
    <a class="social-links" href="https://twitter.com/maxeisen/" target="_blank"><TwitterLogo /></a>
    <a class="social-links" href="mailto:max.eisen@queensu.ca" target="_blank"><MailIcon /></a>
</div>

<div class="headshot">
    <img class="headshot" src={headshot} alt="Empty background headshot"/>
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
        align-self: center;
        margin-left: auto;
        margin-right: auto;
        padding-top: 0;
        width: 200px;
        height: 200px;
        -webkit-filter: drop-shadow(2px -2px 2px #222);
        filter: drop-shadow(2px -2px 2px #222);
    }

    .social-links-container {
        display: flex;
        margin: auto;
        padding-top: 10px;
        padding-bottom: 25px;
        color: #addeff;
        justify-content: center;
    }

    .social-links {
        color: #addeff;
        margin-left: 8px;
        margin-right: 8px;
        width: 40px;
        height: 40px;
    }

    a:hover {
        color: #00bba2;
    }
</style>