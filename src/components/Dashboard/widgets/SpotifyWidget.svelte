<!--
    Spotify now playing + WebGL visualizer behind the album art. Owns the
    data fetch (polled every 30s, plus a one-shot refetch ~2s after each
    track's expected end) and updates the shared spotify + viz stores so the
    fullscreen overlay can render the same scene.

    Visualizer pipeline:
      1. fetch /spotifyNowPlaying
      2. compute vibe from genre or track-id hash
      3. apply paletteForVibe immediately (fast first paint)
      4. asynchronously upgrade to album-art-derived palette

    Size tiers (container queries on the slot): the art tracks the slot's
    height; a short slot sheds the album line, then the progress bar and
    status; a tall, narrow one stacks the art over the text.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import { pad, timeAgo } from "../lib/utils.js";
    import { spotify, viz } from "../lib/stores.svelte.js";
    import {
        makeViz, drawViz, vibeFromTrack, paletteForVibe, extractAlbumPalette,
    } from "../lib/viz.js";
    import { fetchJson, isFetchErrorStatus } from "../../../lib/data/fetchJson.js";
    import { createPoller } from "../../../lib/data/poller.js";
    import WidgetHeader from "./WidgetHeader.svelte";

    let { onavailability = () => {} } = $props();

    let canvasEl = $state();
    let vizCtx = null;
    let raf = 0;
    let loadedOnce = false;
    let stopPoll;
    let stopTick;
    let endTimer = 0; // single pending "refetch at track end" timer

    let now = $state(Date.now()); // re-derives elapsed/progress fill each second

    function fmtMs(ms) {
        if (ms == null || ms < 0) ms = 0;
        const total = Math.floor(ms / 1000);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${m}:${pad(s)}`;
    }

    async function applyTrackData(data) {
        spotify.data = data;
        const vibe = vibeFromTrack(data);
        let palette = paletteForVibe(vibe);
        viz.params = { ...palette, energy: vibe.energy, valence: vibe.valence, tempo: vibe.tempo, dance: vibe.dance };

        if (data?.albumArt) {
            const album = await extractAlbumPalette(data.albumArt, data.id);
            if (album && album.length >= 3) {
                viz.params = {
                    c1: album[0], c2: album[1], c3: album[2],
                    energy: vibe.energy, valence: vibe.valence, tempo: vibe.tempo, dance: vibe.dance,
                };
            }
        }
    }

    async function load() {
        clearTimeout(endTimer); // ensure only one end-of-track refetch is ever pending
        try {
            const data = await fetchJson("/.netlify/functions/spotifyNowPlaying");
            loadedOnce = true;
            onavailability(true);
            if (!data || (!data.track && !data.playing)) {
                spotify.data = null;
                spotify.playing = false;
                spotify.durationMs = 0;
                return;
            }
            spotify.playing = !!data.playing;
            spotify.durationMs = data.durationMs || 0;
            spotify.progressMs = data.progressMs || 0;
            spotify.fetchedAt = Date.now();
            await applyTrackData(data);
            // Refetch ~2s after the track is expected to end — the moment a new
            // song starts is exactly when the 30s poll feels most stale. Only
            // ONE timer is pending (cleared at the top of load), so repeated
            // polls don't pile up into a burst of calls at song end; skipped
            // while the tab is hidden (the poll refreshes on return).
            if (data.playing && data.durationMs) {
                const remaining = data.durationMs - (data.progressMs || 0);
                if (remaining > 0 && remaining < 1000 * 60 * 30) {
                    endTimer = setTimeout(() => { if (!document.hidden) load(); }, remaining + 2000);
                }
            }
        } catch (e) {
            // Nothing to show yet, or the function isn't configured (503):
            // step aside. A blip after a good load keeps the last track up
            // until the next poll.
            if (!loadedOnce || isFetchErrorStatus(e, 503)) onavailability(false);
        }
    }

    const data = $derived(spotify.data);
    const hasTrack = $derived(!!data && (data?.track || data?.playing));
    const elapsedMs = $derived.by(() => {
        if (!spotify.playing || !spotify.durationMs) return 0;
        return Math.min(spotify.durationMs, spotify.progressMs + (now - spotify.fetchedAt));
    });
    const progressPct = $derived(spotify.durationMs ? (elapsedMs / spotify.durationMs) * 100 : 0);
    const statusLabel = $derived.by(() => {
        if (!hasTrack) return "Nothing playing";
        if (data?.playing) return "now-playing";
        if (data?.playedAt) return `Last played · ${timeAgo(data.playedAt)}`;
        return "Recently played";
    });
    const showProgress = $derived(spotify.playing && spotify.durationMs > 0);
    const vizActive = $derived(hasTrack && !!data?.playing);

    function vizLoop() {
        // Skips drawing while the tab, or the tile (an unavailable widget
        // stays mounted, undisplayed), can't be seen.
        if (!document.hidden && vizCtx && canvasEl?.clientWidth) drawViz(vizCtx, viz.params, viz.startTime);
        raf = requestAnimationFrame(vizLoop);
    }

    function openOverlay(e) {
        e.preventDefault();
        e.stopPropagation();
        if (viz.params) viz.overlayOpen = true;
    }

    function handleVizPointerDown(e) {
        // The widget root listens for pointerdown (drag) — stop the fullscreen
        // button from claiming a drag press.
        e.stopPropagation();
    }

    onMount(() => {
        if (window.WebGLRenderingContext && canvasEl) {
            vizCtx = makeViz(canvasEl);
            if (vizCtx) vizLoop();
        }
        load();
        // 30s now-playing poll + 1s progress-bar tick, both visibility-aware
        // (silent in a backgrounded tab, refresh on return). The poll is
        // deliberately NOT more frequent: it's an uncacheable function call
        // that crosses Cloudflare→Netlify on every fire, and a tighter
        // interval is the single biggest sustained source of origin requests
        // from the shared Cloudflare edge IP — which is what trips Netlify's
        // per-IP rate limit (sitewide 429s). Freshness is preserved anyway:
        // the progress bar interpolates locally every 1s, and load()
        // self-schedules a refetch at each track's expected end (see below),
        // so only a manual skip lags, by ≤30s.
        stopPoll = createPoller(load, 1000 * 30, { jitterMs: 3000 });
        stopTick = createPoller(() => { now = Date.now(); }, 1000);
    });
    onDestroy(() => {
        cancelAnimationFrame(raf);
        clearTimeout(endTimer);
        stopPoll?.();
        stopTick?.();
    });
</script>

<canvas class="spotify-viz" class:active={vizActive} bind:this={canvasEl} aria-hidden="true"></canvas>
<WidgetHeader profileHref="https://open.spotify.com/user/maxeisen" profileLabel="Spotify" />
{#if vizActive}
    <button
        class="viz-fullscreen-btn"
        type="button"
        aria-label="Fullscreen visualizer"
        title="Fullscreen visualizer"
        onpointerdown={handleVizPointerDown}
        onclick={openOverlay}
    >
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" /></svg>
    </button>
{/if}
<a class="spotify-main" href={data?.url || undefined} target="_blank" rel="noreferrer">
    {#if hasTrack && data.albumArt}
        <img class="spotify-art" src={data.albumArt} alt={data.album || data.track || ""}/>
    {:else}
        <div class="spotify-art spotify-art-placeholder">♪</div>
    {/if}
    <div class="spotify-info">
        <div class="spotify-status">
            {#if statusLabel === "now-playing"}
                <span class="pulse"></span>Now playing
            {:else}
                {statusLabel}
            {/if}
        </div>
        <div class="spotify-track">{hasTrack ? (data.track || "—") : "—"}</div>
        <div class="spotify-artist">{hasTrack ? (data.artist || "") : ""}</div>
        <div class="spotify-album">{hasTrack ? (data.album || "") : ""}</div>
        {#if showProgress}
            <div class="spotify-progress">
                <span>{fmtMs(elapsedMs)}</span>
                <div class="spotify-progress-bar"><div class="spotify-progress-fill" style:width={progressPct.toFixed(2) + "%"}></div></div>
                <span>{fmtMs(spotify.durationMs)}</span>
            </div>
        {/if}
    </div>
</a>

<style>
    .spotify-viz {
        position: absolute;
        inset: 0;
        z-index: 0;
        width: 100%;
        height: 100%;
        border-radius: inherit;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.6s ease;
    }
    .spotify-viz.active { opacity: 0.5; }

    .viz-fullscreen-btn {
        position: absolute;
        right: 14px;
        bottom: 14px;
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        padding: 0;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--text-2);
        cursor: zoom-in;
        transition: color var(--dur-fast) var(--ease);
    }
    .viz-fullscreen-btn:hover { color: var(--text-strong); }
    .viz-fullscreen-btn svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }

    .spotify-main {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: clamp(var(--space-3), 4cqi, var(--space-5));
        flex: 1;
        min-width: 0;
        min-height: 0;
        color: inherit;
    }
    /* As tall as the slot allows (less its padding), within limits. */
    .spotify-art {
        flex-shrink: 0;
        width: clamp(36px, min(28cqi, 100cqh - 2 * var(--widget-pad-y, 20px)), 128px);
        aspect-ratio: 1;
        height: auto;
        border-radius: var(--radius);
        background: var(--surface-2);
        object-fit: cover;
    }
    .spotify-art-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        color: var(--text-3);
    }
    /* Clear of the fullscreen button in the bottom corner. */
    .spotify-info {
        display: flex;
        flex-direction: column;
        justify-content: center;
        flex: 1;
        min-width: 0;
        padding-right: 40px;
    }
    .spotify-status {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-2);
        font-size: var(--font-xs);
        font-weight: var(--weight-medium);
        color: var(--text-2);
    }
    .spotify-status :global(.pulse) {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--tone-good);
        animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
        .spotify-status :global(.pulse) { animation: none; }
    }
    .spotify-track,
    .spotify-artist,
    .spotify-album { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .spotify-track {
        font-size: clamp(0.95rem, min(4.5cqi, 14cqh), 1.6rem);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.02em;
        line-height: 1.2;
        color: var(--text-strong);
    }
    .spotify-artist { margin-top: var(--space-1); font-size: var(--font-sm); color: var(--text); }
    .spotify-album { margin-top: 2px; font-size: var(--font-xs); color: var(--text-3); }
    .spotify-progress {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-top: var(--space-3);
        font-size: var(--font-2xs);
        font-variant-numeric: tabular-nums;
        color: var(--text-3);
    }
    .spotify-progress-bar {
        flex: 1;
        height: 4px;
        border-radius: var(--radius-pill);
        background: var(--surface-2);
        overflow: hidden;
    }
    .spotify-progress-fill {
        height: 100%;
        border-radius: var(--radius-pill);
        background: var(--text-2);
        transition: width 0.5s linear;
    }

    /* Short enough that the text spans the corner link's height too. */
    @container slot (max-height: 170px) {
        .spotify-info { padding-right: 72px; }
    }
    @container slot (max-height: 150px) {
        .spotify-album { display: none; }
        .spotify-status { margin-bottom: var(--space-1); }
        .spotify-progress { margin-top: var(--space-2); }
    }
    /* A strip: just the track and artist, clear of the corner controls. */
    @container slot (max-height: 110px) {
        .spotify-status,
        .spotify-progress { display: none; }
        .spotify-info { padding-right: 44px; }
        .viz-fullscreen-btn { top: 50%; bottom: auto; transform: translateY(-50%); }
    }
    @container slot (max-width: 340px) and (min-height: 240px) {
        .spotify-main { flex-direction: column; justify-content: center; text-align: center; }
        .spotify-art { width: clamp(56px, min(40cqi, 45cqh), 128px); }
        .spotify-info { align-items: center; width: 100%; flex: none; padding-right: 0; }
        .spotify-progress { width: 100%; }
    }
</style>
