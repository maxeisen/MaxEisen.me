<!--
    Fullscreen photo viewer with prev/next, keyboard + swipe nav, spinner
    while the 2400px source loads, and parallel ±2 neighbour preload so
    a burst of navigation stays ahead of the user.

    Bindable props:
      - open   (boolean): whether the lightbox is currently visible
      - index  (number):  which photo is showing
-->
<script>
    import { onMount } from "svelte";
    import { lightboxUrl } from "./lib/cloudinary.js";
    import { downloadOne } from "./lib/download.js";

    let {
        photos = [],
        open = $bindable(false),
        index = $bindable(0),
        /** When true, surface a download button for the current photo. */
        downloadEnabled = false,
    } = $props();

    let imgEl;
    let spinnerVisible = $state(false);
    let captionText = $state("");
    let captionVisible = $state(false);

    let loadToken = 0;
    const preloaded = new Set();

    function preloadNeighbor(i) {
        if (!photos.length) return;
        const norm = ((i % photos.length) + photos.length) % photos.length;
        const url = lightboxUrl(photos[norm]);
        if (preloaded.has(url)) return;
        preloaded.add(url);
        const img = new Image();
        img.src = url;
    }

    function showAt(i, { keepCurrent = true } = {}) {
        if (!photos.length) return;
        index = ((i % photos.length) + photos.length) % photos.length;
        const url = lightboxUrl(photos[index]);
        const myToken = ++loadToken;

        if (!keepCurrent) {
            // First open — clear stale src so we don't flash the previous photo.
            if (imgEl) imgEl.removeAttribute("src");
            captionVisible = false;
        }
        spinnerVisible = true;

        // Warm neighbours in parallel — by the time the user clicks next,
        // the photo is already in browser HTTP cache.
        preloadNeighbor(index + 1);
        preloadNeighbor(index - 1);
        preloadNeighbor(index + 2);
        preloadNeighbor(index - 2);

        const probe = new Image();
        const landed = () => {
            if (myToken !== loadToken) return;
            if (imgEl) imgEl.src = url;
            // Caption mirrors the MasonryGrid figcaption — uploader name and
            // location joined by a center dot when both are present, either
            // one alone otherwise. Empty caption stays hidden.
            const p = photos[index] || {};
            const parts = [p.uploader, p.caption].filter(Boolean);
            captionText = parts.join(" · ");
            captionVisible = parts.length > 0;
            spinnerVisible = false;
        };
        probe.onload = landed;
        probe.onerror = landed;
        probe.src = url;
    }

    function next() { showAt(index + 1); }
    function prev() { showAt(index - 1); }
    function close() {
        open = false;
        if (imgEl) imgEl.removeAttribute("src");
        spinnerVisible = false;
        captionVisible = false;
        document.body.style.overflow = "";
        loadToken++;
    }

    // React to external open/index changes.
    let wasOpen = false;
    $effect(() => {
        if (open && !wasOpen) {
            showAt(index, { keepCurrent: false });
            document.body.style.overflow = "hidden";
        } else if (!open && wasOpen) {
            // Already cleared in close(); this branch covers parent-driven close.
            spinnerVisible = false;
            captionVisible = false;
            document.body.style.overflow = "";
        }
        wasOpen = open;
    });

    function onBackgroundClick(e) {
        if (e.target === e.currentTarget) close();
    }
    function onKeydown(e) {
        if (!open) return;
        if (e.key === "Escape") close();
        else if (e.key === "ArrowRight") next();
        else if (e.key === "ArrowLeft") prev();
    }

    // Touch gestures on the photo (touch-action:none on the overlay stops the
    // browser's own pan/zoom so none of this moves the page behind):
    //   • quick 1-finger drag      → swipe to prev/next
    //   • 1-finger press-and-hold   → "peek": zoom in at that point, drag to
    //                                  pan, release to snap back (Instagram-ish)
    //   • 2-finger pinch            → zoom, release to snap back
    const PEEK_SCALE = 2.5;
    const HOLD_MS = 220;     // press this long (without moving) → enter zoom
    const MOVE_CANCEL = 12;  // px moved before that → it's a swipe, not a zoom
    const dist2 = (a, b) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

    let touchStartX = null, touchStartY = null;
    let pinching = false, pinchStartDist = 0;
    let peeking = false, peekTimer = 0, peekStart = null, peekRect = null;
    let snapTimer = 0;

    function snapBack() {
        if (!imgEl) return;
        imgEl.style.transition = "transform 0.25s ease";
        imgEl.style.transform = "";
        snapTimer = setTimeout(() => { if (imgEl) { imgEl.style.transition = ""; imgEl.style.transformOrigin = ""; } }, 280);
    }
    function setOrigin(x, y) {
        peekRect = imgEl.getBoundingClientRect();
        const ox = clamp(((x - peekRect.left) / peekRect.width) * 100, 0, 100);
        const oy = clamp(((y - peekRect.top) / peekRect.height) * 100, 0, 100);
        imgEl.style.transformOrigin = `${ox}% ${oy}%`;
    }
    function startPeek() {
        if (!imgEl || !peekStart) return;
        peeking = true;
        clearTimeout(snapTimer);
        setOrigin(peekStart.x, peekStart.y);
        imgEl.style.transition = "transform 0.18s ease"; // smooth zoom-in
        imgEl.style.transform = `scale(${PEEK_SCALE})`;
    }

    function onTouchStart(e) {
        if (e.touches.length === 2) {
            clearTimeout(peekTimer); peekTimer = 0; peeking = false;
            pinching = true; touchStartX = null;
            const [a, b] = e.touches;
            pinchStartDist = dist2(a, b) || 1;
            if (imgEl) { clearTimeout(snapTimer); imgEl.style.transition = "none"; setOrigin((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2); }
        } else if (e.touches.length === 1 && !pinching) {
            const t = e.touches[0];
            touchStartX = t.clientX; touchStartY = t.clientY;
            peekStart = { x: t.clientX, y: t.clientY };
            clearTimeout(peekTimer);
            peekTimer = setTimeout(startPeek, HOLD_MS);
        }
    }

    function onTouchMove(e) {
        if (pinching && e.touches.length === 2 && imgEl) {
            imgEl.style.transform = `scale(${clamp(dist2(e.touches[0], e.touches[1]) / pinchStartDist, 1, 4)})`;
            return;
        }
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        if (peeking && imgEl) {
            // Pan: drag follows the finger, clamped so the photo can't leave view.
            const maxX = ((PEEK_SCALE - 1) * peekRect.width) / 2;
            const maxY = ((PEEK_SCALE - 1) * peekRect.height) / 2;
            const dx = clamp(t.clientX - peekStart.x, -maxX, maxX);
            const dy = clamp(t.clientY - peekStart.y, -maxY, maxY);
            imgEl.style.transition = "none";
            imgEl.style.transform = `translate(${dx}px, ${dy}px) scale(${PEEK_SCALE})`;
            return;
        }
        // Still pending: enough movement means a swipe, so cancel the hold.
        if (peekTimer && Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY) > MOVE_CANCEL) {
            clearTimeout(peekTimer); peekTimer = 0;
        }
    }

    function onTouchEnd(e) {
        clearTimeout(peekTimer); peekTimer = 0;
        if (pinching) { if (e.touches.length < 2) { pinching = false; snapBack(); } return; }
        if (peeking) { peeking = false; snapBack(); return; }
        if (touchStartX == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
        if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
        touchStartX = null;
    }

    onMount(() => {
        const handler = (e) => onKeydown(e);
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    });
</script>

<div
    class="lightbox"
    class:open
    role="dialog"
    aria-modal="true"
    aria-label="Photo viewer"
    onclick={onBackgroundClick}
    ontouchstart={onTouchStart}
    ontouchmove={onTouchMove}
    ontouchend={onTouchEnd}
>
    {#if downloadEnabled}
        <button
            class="lightbox-download"
            onclick={(e) => { e.stopPropagation(); downloadOne(photos[index]); }}
            aria-label="Download this photo"
            title="Download"
        >
            <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 2 L8 11 M4 7.5 L8 11.5 L12 7.5 M3 14 L13 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
    {/if}
    <button class="lightbox-close" onclick={close} aria-label="Close">×</button>
    <button class="lightbox-nav lightbox-prev" onclick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous photo">‹</button>
    <button class="lightbox-nav lightbox-next" onclick={(e) => { e.stopPropagation(); next(); }} aria-label="Next photo">›</button>
    <div class="lightbox-spinner" class:visible={spinnerVisible} aria-hidden="true"></div>
    <img bind:this={imgEl} alt=""/>
    <div class="lightbox-caption" hidden={!captionVisible}>{captionText}</div>
</div>

<style>
    .lightbox {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.92);
        z-index: 999;
        display: none;
        align-items: center;
        justify-content: center;
        cursor: zoom-out;
        /* Swiping between photos must not pan/scroll the page behind (the body
           overflow lock alone isn't enough on iOS). We read swipe coordinates
           ourselves, so the browser needs no touch panning here. */
        touch-action: none;
        overscroll-behavior: contain;
    }
    .lightbox.open { display: flex; }
    .lightbox img {
        max-width: 92vw;
        max-height: 92vh;
        cursor: default;
        border-radius: 8px;
        box-shadow: 0 12px 60px rgba(0, 0, 0, 0.6);
        transition: opacity 0.2s ease;
    }
    .lightbox img:not([src]),
    .lightbox img[src=""] { opacity: 0; }
    .lightbox-close {
        position: absolute;
        top: 1rem;
        right: 1.25rem;
        background: none;
        border: none;
        color: #fff;
        font-size: 2rem;
        line-height: 1;
        cursor: pointer;
        opacity: 0.6;
        transition: opacity 0.2s ease;
    }
    .lightbox-close:hover { opacity: 1; }

    /* Download sits to the left of close, same vertical position. */
    .lightbox-download {
        position: absolute;
        top: 1rem;
        right: 3.75rem;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #fff;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0.6;
        padding: 0;
        transition: opacity 0.2s ease, background 0.2s ease, transform 0.1s ease;
    }
    .lightbox-download:hover { opacity: 1; background: rgba(0, 0, 0, 0.7); }
    .lightbox-download:active { transform: scale(0.94); }
    .lightbox-download svg { width: 16px; height: 16px; display: block; }

    .lightbox-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #fff;
        font-size: 2rem;
        line-height: 1;
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        cursor: pointer;
        opacity: 0.6;
        transition: opacity 0.2s ease, background 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        padding-bottom: 2px;
    }
    .lightbox-nav:hover { opacity: 1; background: rgba(0, 0, 0, 0.7); }
    .lightbox-prev { left: 1.25rem; }
    .lightbox-next { right: 1.25rem; }
    @media (max-width: 600px) {
        .lightbox-nav { width: 2.5rem; height: 2.5rem; font-size: 1.6rem; }
        .lightbox-prev { left: 0.5rem; }
        .lightbox-next { right: 0.5rem; }
    }

    .lightbox-spinner {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 44px;
        height: 44px;
        border: 3px solid rgba(255, 255, 255, 0.18);
        border-top-color: var(--main-green);
        border-radius: 50%;
        opacity: 0;
        transition: opacity 0.18s ease;
        pointer-events: none;
        z-index: 1;
    }
    .lightbox-spinner.visible { opacity: 1; animation: lightbox-spin 0.8s linear infinite; }
    @keyframes lightbox-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
        .lightbox-spinner.visible { animation: none; }
    }

    .lightbox-caption {
        position: absolute;
        bottom: 1rem;
        left: 50%;
        transform: translateX(-50%);
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
        color: #fff;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        max-width: calc(100% - 4rem);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        pointer-events: none;
    }
</style>
