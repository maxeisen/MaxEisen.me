<!--
    /gallery/ride — password-gated cycling gallery with uploads enabled.
-->
<script>
    import Gallery from "../components/Gallery/Gallery.svelte";
</script>

<svelte:head>
    <title>Rides | MaxEisen.me</title>
    <link rel="canonical" href="https://maxeisen.me/gallery/ride"/>
</svelte:head>

<Gallery
    tag="ride"
    title="Rides"
    sort="date-desc"
    passwordScope="ride"
    uploadEnabled
>
    {#snippet intro()}
        <p>A private gallery of cycling photos — long road rides and post-ride espressos with friends.</p>
        <p>Hosted on <a href="https://cloudinary.com" target="_blank" rel="noreferrer">Cloudinary</a>. Thumbnails load lazily and the lightbox preloads neighbours so prev/next feels instant.</p>
    {/snippet}
</Gallery>
