<!--
    Anchors to /gallery, fronts a random photo from the gallery tag as a
    background. The whole widget is an <a>, so clicking anywhere navigates.
-->
<script>
    import { onMount, onDestroy } from "svelte";

    const CLOUDINARY_CLOUD = "meisen-gallery";
    const CLOUDINARY_TAG = "gallery";

    let imgEl = $state();
    let visible = $state(true);
    let pollTimer;

    function cloudinaryUrl(publicId, transforms) {
        return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/${transforms}/${publicId}`;
    }

    async function load() {
        try {
            const res = await fetch(`https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/list/${CLOUDINARY_TAG}.json`);
            if (!res.ok) throw new Error("gallery list failed");
            const data = await res.json();
            const photos = data.resources || [];
            if (photos.length === 0) { visible = false; return; }
            const pick = photos[Math.floor(Math.random() * photos.length)];
            if (imgEl) {
                imgEl.onload = () => imgEl.classList.add("loaded");
                imgEl.src = cloudinaryUrl(pick.public_id, "f_auto,q_auto,c_fill,g_auto,w_1600,h_1200");
            }
        } catch {
            visible = false;
        }
    }

    onMount(() => {
        load();
        pollTimer = setInterval(load, 1000 * 60 * 2);
    });
    onDestroy(() => clearInterval(pollTimer));
</script>

{#if visible}
    <img class="gallery-img" bind:this={imgEl} alt="" loading="lazy"/>
    <div class="gallery-overlay">
        <div class="gallery-label">Gallery</div>
        <div class="gallery-cta">View all →</div>
    </div>
{/if}

<style>
    .gallery-img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transition: opacity 0.5s ease;
    }
    .gallery-img:global(.loaded) { opacity: 1; }
    .gallery-overlay {
        position: absolute;
        inset: 0;
        padding: 1rem;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.15) 50%, transparent 100%);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        z-index: 1;
    }
    .gallery-label {
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #fff;
        opacity: 0.9;
        text-shadow: 0 1px 8px rgba(0, 0, 0, 0.6);
    }
    .gallery-cta {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-size: 1rem;
        color: #fff;
        letter-spacing: -0.01em;
        text-shadow: 0 1px 8px rgba(0, 0, 0, 0.6);
    }
</style>
