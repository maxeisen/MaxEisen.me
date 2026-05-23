<!--
    Masonry layout of photo thumbnails.

    Owns the preload-on-interaction logic:
      - hover (80ms debounce) — desktop pointer
      - touchstart — mobile head start
      - IntersectionObserver (rootMargin 300px) — works for any input
      - first-10 background warm on mount

    Emits `onopen(index)` when a figure is clicked, so the parent can open
    its lightbox at that index.
-->
<script>
    import { onMount } from "svelte";
    import { thumbUrl, lightboxUrl } from "./lib/cloudinary.js";

    let { photos = [], onopen } = $props();

    let gridEl;
    const lightboxPreloaded = new Set();

    function preloadFullSize(idx) {
        if (idx < 0 || idx >= photos.length) return;
        const url = lightboxUrl(photos[idx]);
        if (lightboxPreloaded.has(url)) return;
        lightboxPreloaded.add(url);
        const img = new Image();
        img.src = url;
    }

    function figureIndex(target) {
        const fig = target.closest("figure");
        if (!fig || !gridEl) return -1;
        return Array.prototype.indexOf.call(gridEl.children, fig);
    }

    function onClick(e) {
        const idx = figureIndex(e.target);
        if (idx >= 0) onopen?.(idx);
    }

    let hoverTimer = null;
    function onMouseover(e) {
        const idx = figureIndex(e.target);
        if (idx < 0) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => preloadFullSize(idx), 80);
    }
    function onMouseout() { clearTimeout(hoverTimer); }

    function onTouchStart(e) {
        const idx = figureIndex(e.target);
        if (idx >= 0) preloadFullSize(idx);
    }

    onMount(() => {
        // Background warm: first 10 lightbox URLs so prev/next is already
        // cached by the time anyone opens anything. Browser's
        // 6-concurrent-per-origin limit naturally throttles.
        for (let i = 0; i < Math.min(10, photos.length); i++) preloadFullSize(i);

        // IntersectionObserver: warm the full-size for each figure as it
        // enters the viewport. Mobile equivalent of hover preload.
        if (!("IntersectionObserver" in window)) return;
        const io = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const idx = Array.prototype.indexOf.call(gridEl.children, entry.target);
                if (idx >= 0) preloadFullSize(idx);
                io.unobserve(entry.target);
            }
        }, { rootMargin: "300px" });
        Array.from(gridEl.children).forEach((fig) => io.observe(fig));
        return () => io.disconnect();
    });

    function aspectPadding(p) {
        if (!p.width || !p.height) return null;
        return `${((p.height / p.width) * 100).toFixed(2)}%`;
    }
</script>

<div
    class="gallery"
    bind:this={gridEl}
    onclick={onClick}
    onmouseover={onMouseover}
    onfocusin={onMouseover}
    onmouseout={onMouseout}
    onfocusout={onMouseout}
    ontouchstart={onTouchStart}
    role="list"
>
    {#each photos as p (p.public_id)}
        {@const pad = aspectPadding(p)}
        <figure role="listitem">
            <div
                style:padding-bottom={pad}
                style:position={pad ? "relative" : null}
            >
                <img
                    src={thumbUrl(p)}
                    alt={p.location || ""}
                    loading="lazy"
                    style:position={pad ? "absolute" : null}
                    style:inset={pad ? "0" : null}
                    onload={(e) => e.currentTarget.classList.add("loaded")}
                />
            </div>
            {#if p.location}<figcaption>{p.location}</figcaption>{/if}
        </figure>
    {/each}
</div>

<style>
    .gallery {
        column-count: 4;
        column-gap: 1rem;
    }
    @media (max-width: 1200px) { .gallery { column-count: 3; } }
    @media (max-width: 800px)  { .gallery { column-count: 2; } }
    @media (max-width: 480px)  { .gallery { column-count: 1; } }

    .gallery :global(figure) {
        margin: 0 0 1rem 0;
        break-inside: avoid;
        border-radius: 12px;
        overflow: hidden;
        background: var(--main-green-translucent);
        cursor: zoom-in;
        transition: transform 0.2s ease;
    }
    .gallery :global(figure:hover) { transform: translateY(-2px); }
    .gallery :global(img) {
        display: block;
        width: 100%;
        height: auto;
        opacity: 0;
        transition: opacity 0.5s ease;
    }
    .gallery :global(img.loaded) { opacity: 1; }
    .gallery :global(figcaption) {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 1.25rem 1rem 0.85rem 1rem;
        font-size: 0.78rem;
        color: #fff;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, transparent 100%);
        text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
    }
    .gallery :global(figure:hover figcaption) { opacity: 1; }
    .gallery :global(figure > div) { line-height: 0; }
</style>
