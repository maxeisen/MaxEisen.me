<!--
    Masonry layout of photo thumbnails. Uses CSS column-count for the
    masonry effect, which flows photos top-down within each column then
    moves to the next column. The lightbox iterates the same photos
    array order, so "next" from any photo navigates down the column
    (or wraps to the top of the next column at column boundaries).

    A previous version of this component pre-distributed indices to
    produce a row-major reading order, but CSS column-fill:balance
    rebalances by content height, so unequal photo aspect ratios broke
    the assumed item-count-per-column and nav landed on the wrong photo.
    The natural column-major flow is predictable in every case.

    Owns the preload-on-interaction logic:
      - hover (80ms debounce) — desktop pointer
      - touchstart — mobile head start
      - IntersectionObserver (rootMargin 300px) — works for any input
      - first-10 background warm on mount

    Emits `onopen(idx)` when a figure is clicked in normal mode,
    `ontoggle(idx)` when clicked while `selectionMode` is on.
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
        /** Set selection state explicitly (drag-select uses this). */
        onset,
        /** When true, render a per-photo download arrow on hover/tap. */
        downloadEnabled = false,
        /** Called with the original index when the download arrow is hit. */
        ondownload,
    } = $props();

    let gridEl = $state();
    const lightboxPreloaded = new Set();

    function preloadFullSize(idx) {
        if (idx < 0 || idx >= photos.length) return;
        const url = lightboxUrl(photos[idx]);
        if (lightboxPreloaded.has(url)) return;
        lightboxPreloaded.add(url);
        const img = new Image();
        img.src = url;
    }

    // Single-tap behaviour. Drag-select handles its own start figure when it
    // commits past the threshold, and sets `suppressNextClick` so this
    // handler doesn't double-toggle that figure.
    let suppressNextClick = false;
    function activate(originalIdx) {
        if (suppressNextClick) { suppressNextClick = false; return; }
        if (selectionMode) ontoggle?.(originalIdx);
        else onopen?.(originalIdx);
    }

    // Drag-to-select. In selection mode, pointerdown on a figure starts
    // tracking; once the pointer moves past DRAG_THRESHOLD, we "commit" to
    // drag-select: the starting figure flips state (which determines whether
    // we're painting selections or deselections), and every figure the
    // pointer subsequently crosses adopts that same state. Single taps don't
    // cross the threshold so the normal click handler still drives toggling.
    const DRAG_THRESHOLD = 5;
    function applyState(idx, selected) {
        const id = photos[idx]?.public_id;
        if (!id) return;
        if (onset) onset(idx, selected);
        else if (selected) selectedIds.add(id);
        else selectedIds.delete(id);
    }

    // Edge-scroll while drag-selecting: when the pointer sits within
    // EDGE_PX of the viewport top or bottom, the page scrolls in that
    // direction at a speed that ramps with how deep into the edge zone
    // the cursor is. RAF re-runs elementFromPoint after each scroll so
    // figures revealed by the scroll get painted automatically.
    //
    // The body has `scroll-behavior: smooth` (for the in-page anchor link
    // to the upload zone), which would otherwise animate every per-frame
    // scrollBy and visibly throttle drag scrolling — passing
    // behavior:"instant" inside the loop bypasses that.
    const EDGE_PX = 120;
    const MAX_SCROLL_PER_FRAME = 48;

    function onGridPointerDown(e) {
        if (!selectionMode) return;
        if (e.button !== undefined && e.button !== 0) return;
        // Ignore clicks on the per-figure download button (or any descendant
        // button) — those have their own handlers and aren't selection targets.
        if (e.target?.closest?.("button")) return;
        const fig = e.target?.closest?.("figure[data-original-idx]");
        if (!fig || !gridEl?.contains(fig)) return;
        const startIdx = Number(fig.dataset.originalIdx);
        if (!Number.isFinite(startIdx)) return;

        const pointerId = e.pointerId;
        const startX = e.clientX;
        const startY = e.clientY;
        let committed = false;
        let paintSelected = null;
        const visited = new Set();
        let lastClientX = e.clientX;
        let lastClientY = e.clientY;
        let edgeScrollRaf = 0;

        function paintUnder(x, y) {
            const el = document.elementFromPoint(x, y);
            const f = el?.closest?.("figure[data-original-idx]");
            if (!f || !gridEl?.contains(f)) return;
            const idx = Number(f.dataset.originalIdx);
            if (Number.isFinite(idx) && !visited.has(idx)) {
                visited.add(idx);
                applyState(idx, paintSelected);
            }
        }

        function edgeScrollDelta() {
            const vh = window.innerHeight;
            const fromTop = lastClientY;
            const fromBot = vh - lastClientY;
            // Quadratic-ish ramp (sqrt of depth) so even shallow entry
            // into the edge zone gives a usable scroll speed.
            if (fromTop < EDGE_PX) {
                const depth = 1 - fromTop / EDGE_PX;
                return -Math.ceil(MAX_SCROLL_PER_FRAME * Math.sqrt(depth));
            }
            if (fromBot < EDGE_PX) {
                const depth = 1 - fromBot / EDGE_PX;
                return Math.ceil(MAX_SCROLL_PER_FRAME * Math.sqrt(depth));
            }
            return 0;
        }

        function tickEdgeScroll() {
            const dy = edgeScrollDelta();
            if (dy === 0) { edgeScrollRaf = 0; return; }
            const before = window.scrollY;
            // behavior:"instant" overrides the body's scroll-behavior:smooth
            // (which the anchor link to the upload zone needs but would
            // otherwise animate-throttle every per-frame scrollBy here).
            window.scrollBy({ top: dy, behavior: "instant" });
            // If the page didn't actually move (already at top/bottom), bail
            // so we don't churn RAF for nothing.
            if (window.scrollY === before) { edgeScrollRaf = 0; return; }
            paintUnder(lastClientX, lastClientY);
            edgeScrollRaf = requestAnimationFrame(tickEdgeScroll);
        }

        const onMove = (ev) => {
            if (ev.pointerId !== pointerId) return;
            if (!committed) {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
                committed = true;
                // Toggle the starting figure now and lock in the paint state.
                const startPhoto = photos[startIdx];
                const wasSelected = !!(startPhoto && selectedIds.has(startPhoto.public_id));
                paintSelected = !wasSelected;
                applyState(startIdx, paintSelected);
                visited.add(startIdx);
            }
            // Prevent text selection + (where possible) page scroll while
            // painting across the grid.
            ev.preventDefault();
            lastClientX = ev.clientX;
            lastClientY = ev.clientY;
            paintUnder(lastClientX, lastClientY);

            // Kick off the edge-scroll loop if we're near a viewport edge.
            if (!edgeScrollRaf && edgeScrollDelta() !== 0) {
                edgeScrollRaf = requestAnimationFrame(tickEdgeScroll);
            }
        };

        const onEnd = (ev) => {
            if (ev.pointerId !== pointerId) return;
            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onEnd);
            document.removeEventListener("pointercancel", onEnd);
            if (edgeScrollRaf) {
                cancelAnimationFrame(edgeScrollRaf);
                edgeScrollRaf = 0;
            }
            if (committed) {
                // Suppress the click event that synchronously follows
                // pointerup on the starting figure so its state doesn't
                // immediately revert.
                suppressNextClick = true;
                // Belt-and-suspenders — clear after a tick in case no click
                // event ever fires (e.g. pointercancel, or pointer left the
                // figure entirely).
                setTimeout(() => { suppressNextClick = false; }, 50);
            }
        };

        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onEnd);
        document.addEventListener("pointercancel", onEnd);
    }

    // A thumbnail whose Cloudinary derivative is still being generated on
    // first access can come back slow or, under a large herd of concurrent
    // first-time requests, error out (transient lock / rate response). Once
    // a derivative is generated it's cached, so a couple of backed-off
    // retries reliably recover it instead of leaving a permanently grey tile.
    function retryThumb(e) {
        const img = e.currentTarget;
        const tries = Number(img.dataset.retries || 0);
        if (tries >= 3) return;
        const src = img.dataset.src || img.src;
        img.dataset.src = src;
        img.dataset.retries = String(tries + 1);
        img.src = "";
        setTimeout(() => { img.src = src; }, 700 * (tries + 1));
    }

    let hoverTimer = null;
    function onHover(idx) {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => preloadFullSize(idx), 80);
    }
    function onHoverOut() { clearTimeout(hoverTimer); }

    onMount(() => {
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

        return () => io?.disconnect();
    });

    function aspectPadding(p) {
        if (!p.width || !p.height) return null;
        return `${((p.height / p.width) * 100).toFixed(2)}%`;
    }
</script>

<div
    class="gallery"
    class:selecting={selectionMode}
    bind:this={gridEl}
    role="list"
    onpointerdown={onGridPointerDown}
>
    {#each photos as p, originalIdx (p.public_id ?? originalIdx)}
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
                    alt={p.caption || ""}
                    loading="lazy"
                    style:position={pad ? "absolute" : null}
                    style:inset={pad ? "0" : null}
                    onload={(e) => e.currentTarget.classList.add("loaded")}
                    onerror={retryThumb}
                />
                {#if selectionMode}
                    <span class="select-check" aria-hidden="true">
                        {#if selected}<svg viewBox="0 0 16 16"><path d="M3 8.5 L6.5 12 L13 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>{/if}
                    </span>
                {:else if downloadEnabled}
                    <!-- Per-photo download. Hidden by default on hover-capable
                         pointers (revealed by CSS on figure:hover), and pinned
                         visible on coarse pointers (touch) so phone users can
                         find it without a hover state. -->
                    <button
                        type="button"
                        class="figure-download"
                        aria-label="Download this photo"
                        title="Download"
                        onclick={(e) => { e.stopPropagation(); ondownload?.(originalIdx); }}
                    >
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M8 2 L8 11 M4 7.5 L8 11.5 L12 7.5 M3 14 L13 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                {/if}
            </div>
            {#if p.uploader || p.caption}
                <figcaption>
                    {#if p.uploader}<span class="caption-uploader">{p.uploader}</span>{/if}
                    {#if p.uploader && p.caption}<span class="caption-sep"> · </span>{/if}
                    {#if p.caption}<span class="caption-text">{p.caption}</span>{/if}
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
    .gallery.selecting :global(figure) {
        cursor: pointer;
        /* Lock out browser pan/zoom so the drag-select pointermove handler
           can preventDefault and paint across photos without the page
           scrolling out from under the user's finger. Outside selection
           mode, default touch behaviour is restored. */
        touch-action: none;
        -webkit-user-select: none;
        user-select: none;
    }
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

    /* Per-photo download arrow. Top-right of each figure (same anchor as
       the selection check, but never shown at the same time). Hidden on
       hover-capable pointers until the user hovers; on coarse pointers
       (touch) it's always visible so phone users can hit it. */
    .gallery :global(.figure-download) {
        position: absolute;
        top: 0.6rem;
        right: 0.6rem;
        width: 28px;
        height: 28px;
        padding: 0;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.5);
        border: 2px solid rgba(255, 255, 255, 0.85);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        opacity: 0;
        transition: opacity 0.18s ease, background-color 0.15s ease, transform 0.1s ease;
        z-index: 1;
    }
    .gallery :global(.figure-download svg) { width: 14px; height: 14px; display: block; }
    .gallery :global(figure:hover .figure-download),
    .gallery :global(.figure-download:focus-visible) { opacity: 1; }
    .gallery :global(.figure-download:hover) { background: var(--main-green); border-color: var(--main-green); color: var(--background-one, #1c1a17); }
    .gallery :global(.figure-download:active) { transform: scale(0.92); }
    @media (hover: none) {
        .gallery :global(.figure-download) { opacity: 0.9; }
    }
</style>
