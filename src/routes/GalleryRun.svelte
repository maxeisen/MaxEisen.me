<!--
    /gallery/run — password-gated running gallery with uploads enabled.
-->
<script>
    import Gallery from "../components/Gallery/Gallery.svelte";
</script>

<svelte:head>
    <title>Runs | MaxEisen.me</title>
    <link rel="canonical" href="https://maxeisen.me/gallery/run"/>
</svelte:head>

<Gallery
    tag="run"
    title="Runs"
    sort="date-desc"
    passwordScope="run"
    uploadEnabled
    bulkDownloadEnabled
>
    {#snippet intro()}
        <p>A private gallery of run photos.</p>
        <p>Hosted on <a href="https://cloudinary.com" target="_blank" rel="noreferrer">Cloudinary</a>. Thumbnails load lazily and the lightbox preloads neighbours so prev/next feels instant.</p>
    {/snippet}
</Gallery>
