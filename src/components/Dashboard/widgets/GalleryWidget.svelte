<!--
    Anchors to /gallery, fronts a random photo from the gallery tag as a
    background. The whole widget is an <a>, so clicking anywhere navigates.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import { fetchJsonSwr } from "../../../lib/data/swrCache.js";
    import { CLOUDINARY_CLOUD, cloudinaryUrl } from "../../Gallery/lib/cloudinary.js";

    const CLOUDINARY_TAG = "gallery";
    const LIST_URL = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/list/${CLOUDINARY_TAG}.json`;

    let imgEl = $state();
    let visible = $state(true);
    let photos = [];
    let pollTimer;

    // Swap in a fresh random photo from the already-loaded list. The 2-min
    // timer calls this directly — no need to re-download the whole list just
    // to pick a different image.
    function pickRandom() {
        if (!photos.length || !imgEl) return;
        const pick = photos[Math.floor(Math.random() * photos.length)];
        imgEl.onload = () => imgEl.classList.add("loaded");
        imgEl.src = cloudinaryUrl(pick.public_id, "f_auto,q_auto,c_fill,g_auto,w_1600,h_1200");
    }

    async function loadList() {
        try {
            // The list changes rarely, so cache it for 10 min: re-mounts reuse
            // it instantly and the timer never refetches it.
            const data = await fetchJsonSwr(LIST_URL, {
                maxAgeMs: 1000 * 60 * 10,
                onRevalidate: (d) => { photos = d.resources || []; },
            });
            photos = data.resources || [];
            if (photos.length === 0) { visible = false; return; }
            pickRandom();
        } catch {
            visible = false;
        }
    }

    onMount(() => {
        loadList();
        pollTimer = setInterval(pickRandom, 1000 * 60 * 2);
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
