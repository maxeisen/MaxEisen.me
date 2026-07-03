<!--
    Fullscreen visualizer overlay. Mounts a dedicated WebGL canvas that
    reads from the shared viz store (same palette + start time as the inline
    canvas in SpotifyWidget), and renders the same track meta. Open state
    lives in viz.overlayOpen.

    Clicking the backdrop or canvas closes; clicks inside the meta card and
    Escape both also close.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import { spotify, viz } from "./lib/stores.svelte.js";
    import { makeViz, drawViz } from "./lib/viz.js";
    import { pad, timeAgo } from "./lib/utils.js";
    import { lockBodyScroll, unlockBodyScroll } from "../../lib/ui/bodyScrollLock.js";

    let canvasEl = $state();
    let vizCtx = null;
    let raf = 0;
    let now = $state(Date.now());
    let progressTick;
    let keyHandler;

    const data = $derived(spotify.data);
    const hasTrack = $derived(!!data && !data?._error && (data?.track || data?.playing));
    const elapsedMs = $derived.by(() => {
        if (!spotify.playing || !spotify.durationMs) return 0;
        return Math.min(spotify.durationMs, spotify.progressMs + (now - spotify.fetchedAt));
    });
    const progressPct = $derived(spotify.durationMs ? (elapsedMs / spotify.durationMs) * 100 : 0);

    function fmtMs(ms) {
        if (ms == null || ms < 0) ms = 0;
        const total = Math.floor(ms / 1000);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${m}:${pad(s)}`;
    }

    function close() {
        viz.overlayOpen = false;
    }
    function onBackdropClick(e) {
        if (e.target === e.currentTarget || e.target === canvasEl) close();
    }

    $effect(() => {
        if (!viz.overlayOpen) return;
        lockBodyScroll();
        if (!vizCtx && canvasEl && window.WebGLRenderingContext) {
            vizCtx = makeViz(canvasEl);
            if (vizCtx) loop();
        }
        return () => unlockBodyScroll();
    });

    function loop() {
        if (viz.overlayOpen && !document.hidden && vizCtx) {
            drawViz(vizCtx, viz.params, viz.startTime);
        }
        raf = requestAnimationFrame(loop);
    }

    onMount(() => {
        progressTick = setInterval(() => { now = Date.now(); }, 1000);
        keyHandler = (e) => {
            if (e.key === "Escape" && viz.overlayOpen) close();
        };
        document.addEventListener("keydown", keyHandler);
    });
    onDestroy(() => {
        cancelAnimationFrame(raf);
        clearInterval(progressTick);
        document.removeEventListener("keydown", keyHandler);
        unlockBodyScroll();
    });
</script>

<div
    class="viz-overlay"
    class:open={viz.overlayOpen}
    role="dialog"
    aria-modal="true"
    aria-label="Music visualizer"
    onclick={onBackdropClick}
>
    <button class="viz-overlay-close" aria-label="Close visualizer" onclick={close}>×</button>
    <canvas bind:this={canvasEl}></canvas>
    <div class="viz-overlay-meta" onclick={(e) => e.stopPropagation()}>
        <div class="viz-overlay-card">
            {#if hasTrack && data.albumArt}
                <img class="viz-overlay-art" src={data.albumArt} alt=""/>
            {/if}
            <div class="viz-overlay-info">
                <div class="viz-overlay-status">
                    {#if !hasTrack}
                        Nothing playing
                    {:else if data?.playing}
                        <span class="pulse"></span>Now playing
                    {:else if data?.playedAt}
                        Last played · {timeAgo(data.playedAt)}
                    {:else}
                        Recently played
                    {/if}
                </div>
                <div class="viz-overlay-track">{hasTrack ? (data.track || "—") : "—"}</div>
                <div class="viz-overlay-artist">{hasTrack ? (data.artist || "") : ""}</div>
                <div class="viz-overlay-album">{hasTrack ? (data.album || "") : ""}</div>
            </div>
        </div>
        <div class="viz-overlay-progress">
            <span>{fmtMs(elapsedMs)}</span>
            <div class="viz-overlay-bar"><div class="viz-overlay-fill" style:width={progressPct.toFixed(2) + "%"}></div></div>
            <span>{fmtMs(spotify.durationMs || 0)}</span>
        </div>
        <div class="viz-overlay-extras">
            <span class="viz-overlay-genre">{hasTrack && data.genre ? data.genre : ""}</span>
            {#if hasTrack && data.url}
                <a class="viz-overlay-open" href={data.url} target="_blank" rel="noreferrer">Open in Spotify ↗</a>
            {/if}
        </div>
    </div>
</div>

<style>
    .viz-overlay {
        position: fixed;
        inset: 0;
        background: #000;
        z-index: 10000;
        display: none;
        cursor: zoom-out;
    }
    .viz-overlay.open { display: block; }
    .viz-overlay canvas {
        width: 100%;
        height: 100%;
        display: block;
    }
    .viz-overlay-close {
        position: absolute;
        top: 1rem;
        right: 1.25rem;
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
        transition: opacity 0.2s ease;
        z-index: 2;
    }
    .viz-overlay-close:hover { opacity: 1; }
    .viz-overlay-meta {
        position: absolute;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        width: min(640px, calc(100% - 3rem));
        color: rgba(255, 255, 255, 0.92);
        font-family: 'Inter', sans-serif;
        z-index: 2;
        background: rgba(0, 0, 0, 0.42);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 18px;
        padding: 1.1rem 1.3rem;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        cursor: default;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
    }
    .viz-overlay-card {
        display: flex; align-items: center;
        gap: 1.1rem;
        min-width: 0;
    }
    .viz-overlay-art {
        width: clamp(70px, 9vw, 100px);
        height: clamp(70px, 9vw, 100px);
        border-radius: 10px;
        object-fit: cover;
        flex-shrink: 0;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
    }
    .viz-overlay-info {
        display: flex; flex-direction: column;
        min-width: 0; flex: 1;
    }
    .viz-overlay-status {
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.65);
        display: inline-flex; align-items: center;
        gap: 0.45rem;
        margin-bottom: 0.4rem;
    }
    .viz-overlay-status :global(.pulse) {
        width: 8px; height: 8px; border-radius: 50%;
        background: #fff;
        animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 0.4; transform: scale(0.85); }
        50% { opacity: 1; transform: scale(1.1); }
    }
    .viz-overlay-track {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-size: clamp(1.3rem, 2.2vw, 2rem);
        line-height: 1.1;
        letter-spacing: -0.02em;
        color: #fff;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .viz-overlay-artist {
        font-size: clamp(0.95rem, 1.2vw, 1.1rem);
        color: rgba(255, 255, 255, 0.82);
        margin-top: 0.3rem;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .viz-overlay-album {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.55);
        margin-top: 0.18rem;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .viz-overlay-progress {
        display: flex; align-items: center;
        gap: 0.7rem;
        font-variant-numeric: tabular-nums;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.7);
    }
    .viz-overlay-bar {
        flex: 1;
        height: 4px;
        background: rgba(255, 255, 255, 0.18);
        border-radius: 999px;
        overflow: hidden;
    }
    .viz-overlay-fill {
        height: 100%;
        background: rgba(255, 255, 255, 0.92);
        border-radius: 999px;
        transition: width 0.5s linear;
    }
    .viz-overlay-extras {
        display: flex; align-items: center;
        justify-content: space-between;
        gap: 1rem;
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.6);
    }
    .viz-overlay-genre {
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-weight: 600;
    }
    .viz-overlay-open {
        color: rgba(255, 255, 255, 0.85);
        text-decoration: none;
        font-weight: 600;
        transition: color 0.2s ease;
    }
    .viz-overlay-open:hover { color: #fff; }
</style>
