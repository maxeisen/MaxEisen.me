<!--
    Spotify now playing + WebGL visualizer behind the album art. Owns the
    data fetch (polled every 10s) and updates the shared spotify + viz
    stores so the fullscreen overlay can render the same scene.

    Visualizer pipeline:
      1. fetch /spotifyNowPlaying
      2. compute vibe from genre or track-id hash
      3. apply paletteForVibe immediately (fast first paint)
      4. asynchronously upgrade to album-art-derived palette
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import { pad, timeAgo } from "../lib/utils.js";
    import { spotify, viz } from "../lib/stores.svelte.js";
    import {
        makeViz, drawViz, vibeFromTrack, paletteForVibe, extractAlbumPalette,
    } from "../lib/viz.js";
    import { fetchJson, FetchError } from "../../../lib/data/fetchJson.js";
    import { createPoller } from "../../../lib/data/poller.js";

    let canvasEl = $state();
    let vizCtx = null;
    let raf = 0;
    let hidden = $state(false);
    let stopPoll;
    let stopTick;

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
        try {
            const data = await fetchJson("/.netlify/functions/spotifyNowPlaying");
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
            if (data.playing && data.durationMs) {
                // refetch shortly after the track is expected to finish
                const ttl = data.durationMs - (data.progressMs || 0);
                if (ttl > 0 && ttl < 1000 * 60 * 30) setTimeout(load, ttl + 800);
            }
        } catch (e) {
            if (e instanceof FetchError && e.status === 503) { hidden = true; return; }
            spotify.data = { _error: true };
            spotify.playing = false;
        }
    }

    const data = $derived(spotify.data);
    const isError = $derived(data?._error === true);
    const hasTrack = $derived(!!data && !isError && (data?.track || data?.playing));
    const elapsedMs = $derived.by(() => {
        if (!spotify.playing || !spotify.durationMs) return 0;
        return Math.min(spotify.durationMs, spotify.progressMs + (now - spotify.fetchedAt));
    });
    const progressPct = $derived(spotify.durationMs ? (elapsedMs / spotify.durationMs) * 100 : 0);
    const statusLabel = $derived.by(() => {
        if (isError) return "Spotify unavailable";
        if (!hasTrack) return "Nothing playing";
        if (data?.playing) return "now-playing";
        if (data?.playedAt) return `Last played · ${timeAgo(data.playedAt)}`;
        return "Recently played";
    });
    const showProgress = $derived(spotify.playing && spotify.durationMs > 0);
    const vizActive = $derived(hasTrack && !!data?.playing);

    function vizLoop() {
        if (!document.hidden && vizCtx) drawViz(vizCtx, viz.params, viz.startTime);
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
        stopPoll?.();
        stopTick?.();
    });
</script>

{#if !hidden}
    <canvas class="spotify-viz" class:active={vizActive} bind:this={canvasEl} aria-hidden="true"></canvas>
    <a class="profile-link" href="https://open.spotify.com/user/maxeisen" target="_blank" rel="noreferrer">Spotify ↗</a>
    {#if vizActive}
        <button
            class="viz-fullscreen-btn"
            type="button"
            aria-label="Fullscreen visualizer"
            title="Fullscreen visualizer"
            onpointerdown={handleVizPointerDown}
            onclick={openOverlay}
        >⛶</button>
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
{/if}

<style>
    .spotify-viz {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border-radius: inherit;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.6s ease;
        z-index: 0;
    }
    .spotify-viz.active { opacity: 0.55; }

    .viz-fullscreen-btn {
        position: absolute;
        bottom: 0.6rem;
        right: 0.85rem;
        width: 32px;
        height: 32px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0, 0, 0, 0.45);
        border: 1px solid var(--main-green-translucent);
        border-radius: 50%;
        color: var(--main-green);
        font-size: 0.9rem;
        line-height: 1;
        padding: 0;
        cursor: zoom-in;
        opacity: 0.75;
        transition: opacity 0.2s ease, transform 0.1s ease;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 3;
    }
    .viz-fullscreen-btn:hover { opacity: 1; }
    .viz-fullscreen-btn:active { transform: scale(0.92); }

    .spotify-main {
        display: flex; flex-direction: row; align-items: center;
        gap: 1.25rem;
        text-decoration: none; color: inherit;
        flex: 1; min-width: 0;
        position: relative;
        z-index: 1;
    }
    .spotify-main :global(*) { text-decoration: none; }

    .spotify-art {
        width: clamp(70px, 9vw, 130px);
        height: clamp(70px, 9vw, 130px);
        border-radius: 12px;
        background: var(--main-green-translucent);
        object-fit: cover;
        flex-shrink: 0;
    }
    .spotify-art-placeholder {
        display: flex; align-items: center; justify-content: center;
        color: var(--main-green);
        font-size: 2.5rem;
    }
    .spotify-info { display: flex; flex-direction: column; justify-content: center; min-width: 0; flex: 1; }
    .spotify-status {
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--main-green);
        display: inline-flex; align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.4rem;
    }
    .spotify-status :global(.pulse) {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--main-green);
        animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 0.4; transform: scale(0.85); }
        50% { opacity: 1; transform: scale(1.1); }
    }
    .spotify-track {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-size: clamp(1.1rem, 1.7vw, 1.7rem);
        line-height: 1.15;
        color: var(--header-colour);
        letter-spacing: -0.02em;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .spotify-artist {
        font-size: 0.95rem;
        color: var(--paragraph-colour);
        opacity: 0.8;
        margin-top: 0.25rem;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .spotify-album {
        font-size: 0.8rem;
        color: var(--paragraph-colour);
        opacity: 0.55;
        margin-top: 0.2rem;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .spotify-progress {
        display: flex; align-items: center;
        gap: 0.5rem;
        margin-top: 0.65rem;
        font-size: 0.7rem;
        color: var(--paragraph-colour);
        opacity: 0.7;
        font-variant-numeric: tabular-nums;
    }
    .spotify-progress-bar {
        flex: 1;
        height: 3px;
        background: var(--main-green-translucent);
        border-radius: 999px;
        overflow: hidden;
    }
    .spotify-progress-fill {
        height: 100%;
        background: var(--main-green);
        border-radius: 999px;
        transition: width 0.5s linear;
    }
</style>
