<script>
    let statusHeadshot = './img/headshots/status_headshot.webp';
    let cleanHeadshot = './img/headshots/clean_headshot.webp';
    import LinkedInLogo from 'svelte-icons/io/IoLogoLinkedin.svelte';
    import GitHubLogo from 'svelte-icons/io/IoLogoGithub.svelte';
    import TwitterLogo from 'svelte-icons/io/IoLogoTwitter.svelte';
    import MailIcon from 'svelte-icons/io/IoIosMail.svelte';

    import Annotation from 'svelte-rough-notation';
    import { onMount } from 'svelte';

    let visible = false;
    onMount(() => {
        setTimeout(() => {
            visible = true;
        }, 1000);
    });
</script>

<h1><Annotation bind:visible type="highlight" color="rgba(0, 187, 162, 0.23)">Max Eisen</Annotation></h1>
<h2 class="status">CS <b style="color: #ababab; font-weight: 300">@</b> Queen's University</h2>
<h2 class="location">Toronto, ON</h2>
<div class="social-links-container">
    <a class="social-link linkedin-link" href="https://linkedin.com/in/maxeisen/" rel="noreferrer" target="_blank"><LinkedInLogo /></a>
    <a class="social-link github-link" href="https://github.com/maxeisen/" rel="noreferrer" target="_blank"><GitHubLogo /></a>
    <a class="social-link twitter-link" href="https://twitter.com/maxeisen/" rel="noreferrer" target="_blank"><TwitterLogo /></a>
    <a class="social-link" href="mailto:max.eisen@queensu.ca" rel="noreferrer" target="_blank"><MailIcon /></a>
</div>

<div class="headshot">
    <img class="headshot" src={cleanHeadshot} alt="Current headshot"/>
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
        -webkit-filter: drop-shadow(2px -2px 5px #222);
        filter: drop-shadow(2px -2px 5px #222);
    }

    .lower-headshot {
        opacity: 0;
    }

    .social-links-container {
        display: flex;
        margin: auto;
        padding-top: 10px;
        padding-bottom: 25px;
        color: #addeff;
        justify-content: center;
    }

    .social-link {
        color: #addeff;
        margin-left: 8px;
        margin-right: 8px;
        width: 40px;
        height: 40px;
    }

    .linkedin-link:hover {
        color: #0077b5;
    }

    .github-link:hover {
        color: #4078c0;
    }

    .twitter-link:hover {
        color: #1da1f2;
    }

    a:hover {
        color: #00bba2;
    }
</style>
