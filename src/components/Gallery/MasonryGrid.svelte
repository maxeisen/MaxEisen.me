<!--
    Masonry layout of photo thumbnails.

    Owns the preload-on-interaction logic:
      - hover (80ms debounce) — desktop pointer
      - touchstart — mobile head start
      - IntersectionObserver (rootMargin 300px) — works for any input
      - first-10 background warm on mount

    CSS columns flow photos top-down within each column, so the array order
    `[0, 1, 2, ...]` would visually read 0, N, 2N, ... across the top row.
    We pre-distribute the indices column-major (`displayIndices`) so the
    visual reading order matches the source array order. The column count is
    tracked via matchMedia so the layout reshuffles on viewport resize.

    Emits `onopen(originalIndex)` when a figure is clicked in normal mode,
    `ontoggle(originalIndex)` when clicked while `selectionMode` is on.
-->
<script>
    import { onMount } from "svelte";
    import { thumbUrl, lightboxUrl } from "./lib/cloudinary.js";

    let {
        photos = [],
        onopen,
        /** Selection mode — when true, clicks toggle rather than open. */
        selectionMode = false,
        /** Set of selected public_ids (mutated by parent via ontoggle). */
        selectedIds = new Set(),
        ontoggle,
    } = $props();

    let gridEl = $state();
    const lightboxPreloaded = new Set();

    // Track column count via matchMedia so we can re-distribute the photos
    // when the user resizes between breakpoints. Listening on the queries
    // themselves (vs. window 'resize') means we only recompute when a
    // boundary is actually crossed.
    let colCount = $state(4);

    function computeCols() {
        if (typeof window === "undefined") return;
        if (window.matchMedia("(max-width: 480px)").matches) colCount = 1;
        else if (window.matchMedia("(max-width: 800px)").matches) colCount = 2;
        else if (window.matchMedia("(max-width: 1200px)").matches) colCount = 3;
        else colCount = 4;
    }

    // displayIndices is the order figures appear in the DOM. CSS `column-count`
    // fills column 1 top-to-bottom, then column 2, etc., so to produce a
    // row-major visual order we emit indices in column-major chunks.
    const displayIndices = $derived.by(() => {
        const cols = Math.max(1, colCount);
        const n = photos.length;
        const out = new Array(n);
        let cursor = 0;
        for (let c = 0; c < cols; c++) {
            for (let i = c; i < n; i += cols) {
                out[cursor++] = i;
            }
        }
        return out;
    });

    function preloadFullSize(idx) {
        if (idx < 0 || idx >= photos.length) return;
        const url = lightboxUrl(photos[idx]);
        if (lightboxPreloaded.has(url)) return;
        lightboxPreloaded.add(url);
        const img = new Image();
        img.src = url;
    }

    function activate(originalIdx) {
        if (selectionMode) ontoggle?.(originalIdx);
        else onopen?.(originalIdx);
    }

    let hoverTimer = null;
    function onHover(idx) {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => preloadFullSize(idx), 80);
    }
    function onHoverOut() { clearTimeout(hoverTimer); }

    onMount(() => {
        computeCols();
        const mqs = [
            window.matchMedia("(max-width: 480px)"),
            window.matchMedia("(max-width: 800px)"),
            window.matchMedia("(max-width: 1200px)"),
        ];
        mqs.forEach((mq) => mq.addEventListener("change", computeCols));

        // Background warm: first 10 lightbox URLs so prev/next is already
        // cached by the time anyone opens anything. Browser's
        // 6-concurrent-per-origin limit naturally throttles.
        for (let i = 0; i < Math.min(10, photos.length); i++) preloadFullSize(i);

        // IntersectionObserver: warm the full-size for each figure as it
        // enters the viewport. Mobile equivalent of hover preload.
        let io;
        if ("IntersectionObserver" in window && gridEl) {
            io = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const idx = Number(entry.target.dataset.originalIdx);
                    if (Number.isFinite(idx)) preloadFullSize(idx);
                    io.unobserve(entry.target);
                }
            }, { rootMargin: "300px" });
            Array.from(gridEl.children).forEach((fig) => io.observe(fig));
        }

        return () => {
            mqs.forEach((mq) => mq.removeEventListener("change", computeCols));
            io?.disconnect();
        };
    });

    function aspectPadding(p) {
        if (!p.width || !p.height) return null;
        return `${((p.height / p.width) * 100).toFixed(2)}%`;
    }
</script>

<div class="gallery" class:selecting={selectionMode} bind:this={gridEl} role="list">
    {#each displayIndices as originalIdx (photos[originalIdx]?.public_id ?? originalIdx)}
        {@const p = photos[originalIdx]}
        {@const pad = aspectPadding(p)}
        {@const selected = selectedIds.has(p.public_id)}
        <figure
            role="listitem"
            class:selected
            data-original-idx={originalIdx}
            onclick={() => activate(originalIdx)}
            onmouseover={() => onHover(originalIdx)}
            onfocusin={() => onHover(originalIdx)}
            onmouseout={onHoverOut}
            onfocusout={onHoverOut}
            ontouchstart={() => preloadFullSize(originalIdx)}
        >
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
                {#if selectionMode}
                    <span class="select-check" aria-hidden="true">
                        {#if selected}<svg viewBox="0 0 16 16"><path d="M3 8.5 L6.5 12 L13 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>{/if}
                    </span>
                {/if}
            </div>
            {#if p.uploader || p.location}
                <figcaption>
                    {#if p.uploader}<span class="caption-uploader">{p.uploader}</span>{/if}
                    {#if p.uploader && p.location}<span class="caption-sep"> · </span>{/if}
                    {#if p.location}<span class="caption-location">{p.location}</span>{/if}
                </figcaption>
            {/if}
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
        position: relative;
    }
    .gallery :global(figure:hover) { transform: translateY(-2px); }

    /* Selection mode swaps the cursor + activates the check overlay state. */
    .gallery.selecting :global(figure) { cursor: pointer; }
    .gallery.selecting :global(figure.selected) {
        outline: 3px solid var(--main-green);
        outline-offset: -3px;
    }
    .gallery.selecting :global(figure.selected > div) { opacity: 0.85; }

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
    .gallery.selecting :global(figure:hover figcaption) { opacity: 0; }
    .gallery :global(figure > div) { line-height: 0; transition: opacity 0.2s ease; }

    /* Selection check overlay — empty circle in unselected state, filled
       check when the photo is in the set. Top-right of each photo. */
    .gallery :global(.select-check) {
        position: absolute;
        top: 0.6rem;
        right: 0.6rem;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.5);
        border: 2px solid rgba(255, 255, 255, 0.85);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        transition: background-color 0.15s ease, border-color 0.15s ease;
        z-index: 1;
    }
    .gallery :global(.select-check svg) { width: 16px; height: 16px; display: block; }
    .gallery :global(figure.selected .select-check) {
        background: var(--main-green);
        border-color: var(--main-green);
        color: var(--background-one, #1c1a17);
    }
</style>
