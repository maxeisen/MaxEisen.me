<script>
    import LinkedInLogo from 'svelte-icons/io/IoLogoLinkedin.svelte';
    import GitHubLogo from 'svelte-icons/io/IoLogoGithub.svelte';
    import MailIcon from 'svelte-icons/io/IoIosMail.svelte';
    import Annotation from 'svelte-rough-notation';
    import { onMount } from 'svelte';

    const headshotPath = './img/headshots/2026_amazon_headshot_v2';

    let visible = $state(false);
    onMount(() => {
        const t = setTimeout(() => { visible = true; }, 1000);
        return () => clearTimeout(t);
    });
</script>

<div class="profile">
    <picture>
        <source srcset={`${headshotPath}.webp`} type="image/webp">
        <source srcset={`${headshotPath}.png`} type="image/png">
        <img class="headshot" width="440" height="440" src={`${headshotPath}.webp`} alt="Max Eisen" />
    </picture>

    <div class="who">
        <h1 class="name"><Annotation bind:visible type="highlight" color="var(--highlight)">Max Eisen</Annotation></h1>
        <p class="role">Software Engineer at Wealthsimple</p>
        <p class="location">Toronto, Ontario</p>

        <ul class="socials">
            <li><a aria-label="LinkedIn" href="https://linkedin.com/in/maxeisen/" rel="noreferrer" target="_blank"><LinkedInLogo /></a></li>
            <li><a aria-label="GitHub" href="https://github.com/maxeisen/" rel="noreferrer" target="_blank"><GitHubLogo /></a></li>
            <li><a aria-label="Email" href="mailto:profile@maxeisen.me" rel="noreferrer" target="_blank"><MailIcon /></a></li>
        </ul>
    </div>
</div>

<style>
    .headshot {
        display: block;
        width: 100%;
        max-width: 220px;
        height: auto;
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: var(--radius-lg);
        background: var(--surface-2);
    }
    .who { margin-top: var(--space-5); }
    .name {
        margin: 0;
        font-size: var(--font-xl);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.02em;
    }
    .role, .location { margin: var(--space-1) 0 0; font-size: var(--font-sm); }
    .role { color: var(--text); }
    .location { color: var(--text-3); }

    .socials {
        display: flex;
        gap: var(--space-1);
        margin: var(--space-4) 0 0 -6px;
        padding: 0;
        list-style: none;
    }
    .socials a {
        display: block;
        width: 34px;
        height: 34px;
        padding: 6px;
        border-radius: var(--radius);
        color: var(--text-2);
        transition: color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
    }
    .socials a:hover { color: var(--text-strong); background: var(--surface-2); }

    /* On a phone the profile is a header row: photo beside the name. */
    @media (max-width: 860px) {
        .profile { display: flex; align-items: center; gap: var(--space-5); }
        .headshot { width: 112px; }
        .who { margin-top: 0; }
    }
</style>
