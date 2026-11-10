<!--
    Anchors to /gallery, fronts a random photo from the gallery tag as a
    background. The whole widget is an <a>, so clicking anywhere navigates.

    Each photo is requested cropped to the tile's own shape (rounded up, so a
    small resize reuses the same image) and carries its caption, if it has
    one in Cloudinary.
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
    let caption = $state("");
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
        imgEl.src = cloudinaryUrl(pick.public_id, `f_auto,q_auto,c_fill,g_auto,${cropFor(imgEl)}`);
        caption = pick.context?.custom?.caption || pick.context?.caption || "";
    }

    // The tile's size in device pixels, rounded up to 200px steps and capped,
    // so Cloudinary's g_auto crop matches the tile's shape (portrait or
    // landscape) without a fresh image for every pixel of a resize.
    function cropFor(el) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const step = (n) => Math.min(2400, Math.max(400, Math.ceil((n * dpr) / 200) * 200));
        const w = el.clientWidth || 800;
        const h = el.clientHeight || 600;
        return `w_${step(w)},h_${step(h)}`;
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
        <div class="gallery-foot">
            {#if caption}<div class="gallery-caption">{caption}</div>{/if}
            <div class="gallery-cta">See the gallery →</div>
        </div>
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
    .gallery-foot { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .gallery-caption {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        font-size: var(--font-xs);
        opacity: 0.9;
    }
    .gallery-cta { font-size: var(--font-sm); font-weight: var(--weight-semibold); }
    @container slot (max-height: 140px) {
        .gallery-caption { display: none; }
    }
</style>
