<!--
    /gallery/wedding — TRULY private gallery.

    Photos are uploaded to Cloudinary as `authenticated` delivery type, so
    they can't be reached by URL or enumerated by tag. The `signed` prop
    makes Gallery fetch from signedGalleryList (password-gated, returns
    per-photo signed URLs) instead of the public galleryList. No uploads
    from the site. noindex so the page never shows up in search.
-->
<script>
    import Gallery from "../components/Gallery/Gallery.svelte";
</script>

<svelte:head>
    <title>Wedding | MaxEisen.me</title>
    <meta name="robots" content="noindex"/>
    <link rel="canonical" href="https://maxeisen.me/gallery/wedding"/>
</svelte:head>

<Gallery
    tag="wedding"
    title="Wedding"
    sort="date-desc"
    passwordScope="wedding"
    signed
    bulkDownloadEnabled
>
    {#snippet intro()}
        <p>Photos from our wedding day — a private gallery for family and friends.</p>
        <p>Tap any photo to view it full-screen, start a slideshow, or select photos to download (individually or in bulk).</p>
    {/snippet}
</Gallery>
