<!--
    /gallery — the open, curated main gallery.

    Adding a new public gallery is as small as copying this file: change
    `tag`, `title`, and the intro snippet.
-->
<script>
    import Gallery from "../components/Gallery/Gallery.svelte";
</script>

<svelte:head>
    <title>Gallery | MaxEisen.me</title>
    <link rel="canonical" href="https://maxeisen.me/gallery"/>
</svelte:head>

<Gallery tag="gallery" title="Gallery" sort="random" showCount>
    {#snippet intro({ count })}
        <p>A selection of {#if count != null}<strong>{count}</strong> of {/if} my favourite photos that I've shot on a Fujifilm X100S — sometimes around Toronto, where I live, and often on travels elsewhere in Canada or around the world.</p>
        <p>Hosted on <a href="https://cloudinary.com" target="_blank" rel="noreferrer">Cloudinary</a>. Thumbnails load lazily and the lightbox preloads neighbours so prev/next feels instant.</p>
    {/snippet}
</Gallery>
