<!--
    /bach — collaborative story party game. Password-gated, noindex.
    The Bach component owns everything: gate, host vs player split, polling.
-->
<script>
    import Bach from "../components/Bach/Bach.svelte";
    import { getParty } from "../components/Bach/partyConfig.js";

    const title = getParty().title;
</script>

<svelte:head>
    <title>{title}</title>
    <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Bach />
