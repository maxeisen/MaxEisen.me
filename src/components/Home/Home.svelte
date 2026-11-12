<!--
    Homepage: the site nav, then a two-column page — who I am on the left
    (sticky on a wide screen), everything else on the right as a run of
    ruled sections.

    Imports are grouped by subfolder:
      - sections/ the content blocks
      - modals/   what a row opens into (via ModalProvider)
-->
<script>
    import SiteNav from '../../lib/ui/SiteNav.svelte';
    import ModalProvider from '../../lib/ui/ModalProvider.svelte';

    import Profile from './sections/Profile.svelte';
    import Intro from './sections/Intro.svelte';
    import Experience from './sections/Experience.svelte';
    import Projects from './sections/Projects.svelte';
    import Foundations from './sections/Foundations.svelte';
    import Skills from './sections/Skills.svelte';
    import Footer from './sections/Footer.svelte';
</script>

<svelte:head>
    <!-- Owns the homepage title so client-side navigation back to "/"
         restores it (routes set their own title via <svelte:head>). Matches
         the static <title> in index.html for first paint. -->
    <title>Max Eisen — Software Engineer</title>
</svelte:head>

<SiteNav />
<ModalProvider>
    <main class="home">
        <aside class="profile">
            <Profile />
        </aside>
        <div class="content">
            <Intro />
            <Experience />
            <Projects />
            <Foundations />
            <Skills />
            <Footer />
        </div>
    </main>
</ModalProvider>

<style>
    .home {
        display: grid;
        grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
        gap: var(--space-8);
        max-width: var(--page-max);
        margin: 0 auto;
        padding: var(--space-7) var(--page-gutter) var(--space-7);
    }
    .profile {
        position: sticky;
        top: calc(var(--nav-height) + var(--space-7));
        align-self: start;
    }
    .content { min-width: 0; max-width: 760px; }

    @media (max-width: 860px) {
        .home { grid-template-columns: minmax(0, 1fr); gap: var(--space-6); padding-top: var(--space-6); }
        .profile { position: static; }
    }
</style>
