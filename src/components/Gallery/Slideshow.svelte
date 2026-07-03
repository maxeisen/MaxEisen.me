<!--
    Fullscreen crossfading slideshow.

    - Two layered <img> elements, opacity-crossfaded by a `.visible` class.
    - 5-second interval per slide; each tick waits for the next image to
      actually decode before swapping classes (no blank-frame flicker).
    - Preloads two indices ahead so a slow-decoding image doesn't stall.
    - Display-pixel-aware sizing via lib/cloudinary.displayPixelWidth().
    - Requests fullscreen on open (browser permits it because the caller is
      inside a click handler) and a Wake Lock so the screen doesn't sleep.
-->
<script>
    import { onMount } from "svelte";
    import { slideshowUrl } from "./lib/cloudinary.js";
    import { lockBodyScroll, unlockBodyScroll } from "../../lib/ui/bodyScrollLock.js";

    let {
        photos = [],
        open = $bindable(false),
    } = $props();

    const TICK_MS = 5000;

    let containerEl;
    let imgA;
    let imgB;
    let aVisible = $state(false);
    let bVisible = $state(false);
    let aSrc = $state("");
    let bSrc = $state("");

    let activeIsA = true;        // which slot is currently shown
    let current = 0;             // photos index of the active slot
    let urls = [];               // built once per open
    let timer = null;
    let wakeLock = null;
    const preloaded = new Set();

    function preloadIndex(i) {
        const url = urls?.[i];
        if (!url || preloaded.has(url)) return;
        preloaded.add(url);
        const img = new Image();
        img.src = url;
    }

    async function acquireWakeLock() {
        if (!("wakeLock" in navigator)) return;
        try {
            wakeLock = await navigator.wakeLock.request("screen");
            wakeLock.addEventListener("release", () => { wakeLock = null; });
        } catch { /* user gesture / permission — silently skip */ }
    }
    async function releaseWakeLock() {
        if (!wakeLock) return;
        try { await wakeLock.release(); } catch {}
        wakeLock = null;
    }

    function buildUrls() {
        urls = photos.map((p) => slideshowUrl(p));
        preloaded.clear();
    }

    function tick() {
        if (!urls.length) return;
        const nextIdx = (current + 1) % urls.length;
        const url = urls[nextIdx];
        // Keep two ahead warm so the next-next tick doesn't stall.
        preloadIndex((nextIdx + 1) % urls.length);
        preloadIndex((nextIdx + 2) % urls.length);

        const swap = () => {
            if (activeIsA) {
                bSrc = url;
                bVisible = true;
                aVisible = false;
            } else {
                aSrc = url;
                aVisible = true;
                bVisible = false;
            }
            activeIsA = !activeIsA;
            current = nextIdx;
        };
        const probe = new Image();
        probe.src = url;
        if (probe.complete && probe.naturalWidth > 0) {
            swap();
        } else {
            probe.onload = swap;
            probe.onerror = swap;
        }
    }

    function start() {
        if (!photos.length) return;
        buildUrls();
        current = 0;
        activeIsA = true;
        aSrc = urls[0];
        aVisible = false;
        bSrc = "";
        bVisible = false;

        // Reveal the first slide only once it's decodable.
        const startWhenReady = () => {
            aVisible = true;
            preloadIndex(1);
            preloadIndex(2);
            clearInterval(timer);
            timer = setInterval(tick, TICK_MS);
        };
        if (imgA && imgA.complete && imgA.naturalWidth > 0) startWhenReady();
        else if (imgA) {
            imgA.onload = startWhenReady;
            imgA.onerror = startWhenReady;
        }

        lockBodyScroll();
        const req = containerEl?.requestFullscreen || containerEl?.webkitRequestFullscreen;
        if (req) { try { req.call(containerEl)?.catch?.(() => {}); } catch {} }
        acquireWakeLock();
    }

    function stop() {
        clearInterval(timer);
        timer = null;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            try { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); } catch {}
        }
        aVisible = false;
        bVisible = false;
        aSrc = "";
        bSrc = "";
        unlockBodyScroll();
        releaseWakeLock();
    }

    $effect(() => {
        if (open) start();
        else stop();
    });

    function onClick(e) {
        // Clicking anywhere on the overlay (other than the close button) exits.
        if (e.target.classList?.contains("slideshow-close")) return;
        open = false;
    }

    function onKeydown(e) {
        if (!open) return;
        if (e.key === "Escape") open = false;
    }

    function onFullscreenChange() {
        if (open && !document.fullscreenElement && !document.webkitFullscreenElement) {
            open = false;
        }
    }

    function onVisibilityChange() {
        if (document.visibilityState === "visible" && open && !wakeLock) {
            acquireWakeLock();
        }
    }

    onMount(() => {
        document.addEventListener("keydown", onKeydown);
        document.addEventListener("fullscreenchange", onFullscreenChange);
        document.addEventListener("webkitfullscreenchange", onFullscreenChange);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            document.removeEventListener("keydown", onKeydown);
            document.removeEventListener("fullscreenchange", onFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            stop();
        };
    });
</script>

<div
    class="slideshow"
    class:open
    bind:this={containerEl}
    onclick={onClick}
    role="dialog"
    aria-modal="true"
    aria-label="Slideshow"
>
    <button class="slideshow-close" onclick={() => (open = false)} aria-label="Exit slideshow">×</button>
    <img class="slideshow-img" class:visible={aVisible} src={aSrc || undefined} bind:this={imgA} alt="" />
    <img class="slideshow-img" class:visible={bVisible} src={bSrc || undefined} bind:this={imgB} alt="" />
</div>

<style>
    .slideshow {
        position: fixed;
        inset: 0;
        background: #000;
        z-index: 1100;
        display: none;
        align-items: center;
        justify-content: center;
        cursor: zoom-out;
    }
    .slideshow.open { display: flex; }
    .slideshow-img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        opacity: 0;
        transition: opacity 0.9s ease-in-out;
        pointer-events: none;
    }
    .slideshow-img.visible { opacity: 1; }
    .slideshow-close {
        position: absolute;
        top: 1rem;
        right: 1.25rem;
        background: none;
        border: none;
        color: #fff;
        font-size: 2.2rem;
        line-height: 1;
        cursor: pointer;
        opacity: 0.6;
        z-index: 2;
        transition: opacity 0.2s ease;
    }
    .slideshow-close:hover { opacity: 1; }
</style>
