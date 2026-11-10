<!--
    Anchors to /gallery, fronts a random photo from the gallery tag as a
    background. The whole widget is an <a>, so clicking anywhere navigates.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import { fetchJsonSwr } from "../../../lib/data/swrCache.js";
    import { createPoller } from "../../../lib/data/poller.js";
    import { CLOUDINARY_CLOUD, cloudinaryUrl } from "../../Gallery/lib/cloudinary.js";

    const CLOUDINARY_TAG = "gallery";
    const LIST_URL = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/list/${CLOUDINARY_TAG}.json`;

    let { onavailability = () => {} } = $props();

    let imgEl = $state();
    let visible = $state(true);
    let photos = [];
    let stopPoll;

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
            visible = photos.length > 0;
            onavailability(visible);
            if (visible) pickRandom();
        } catch {
            visible = false;
            onavailability(false);
        }
    }

    onMount(() => {
        loadList();
        // pickRandom sets a new image src (a Cloudinary fetch), so pause it
        // when the tab is hidden; it swaps in a fresh photo on return.
        stopPoll = createPoller(pickRandom, 1000 * 60 * 2, { jitterMs: 10_000 });
    });
    onDestroy(() => stopPoll?.());
</script>

{#if visible}
    <img class="gallery-img" bind:this={imgEl} alt="" loading="lazy"/>
    <div class="gallery-overlay">
        <div class="gallery-label">Photos</div>
        <div class="gallery-cta">See the gallery →</div>
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
        transition: opacity 0.5s ease, transform 0.6s var(--ease);
    }
    .gallery-img:global(.loaded) { opacity: 1; }
    :global(.widget-gallery:hover) .gallery-img { transform: scale(1.02); }
    /* Photo text is white on a dark scrim in both themes. */
    .gallery-overlay {
        position: absolute;
        inset: 0;
        z-index: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: clamp(10px, 4cqmin, 16px) clamp(12px, 5cqmin, 20px);
        background: linear-gradient(to top, rgba(0, 0, 0, 0.55) 0%, transparent 45%),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.35) 0%, transparent 30%);
        color: #fff;
    }
    .gallery-label { font-size: var(--font-xs); font-weight: var(--weight-medium); opacity: 0.9; }
    .gallery-cta { font-size: var(--font-sm); font-weight: var(--weight-semibold); }
</style>
