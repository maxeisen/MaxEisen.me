<!--
    Narration audio for the reveal + voting phases. Rendered once by HostScreen
    for both phases so the <audio> element stays mounted across reveal → voting
    and playback is continuous. Owns the audio blob fetch; publishes playback
    progress to the shared `narration` store for the story view's auto-scroll.
-->
<script>
    import { onDestroy } from "svelte";
    import * as api from "../lib/api.js";
    import { narration, resetNarration } from "../lib/narration.svelte.js";

    let { code, password, gameState, busy = false, compact = false, onRequestTts } = $props();

    let audioUrl = $state(null);
    let audioLoading = $state(false);
    let audioError = $state("");
    let audioPlayer = $state(null);
    /** Object URL we already auto-played (avoid replay on re-bind). */
    let autoPlayedUrl = $state(null);
    /** Round we already fetched narration for (prevents reload churn). */
    let narrationAttempted = $state("");

    function releaseAudio() {
        audioPlayer?.pause();
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        audioUrl = null;
        audioLoading = false;
        audioError = "";
        narrationAttempted = "";
        autoPlayedUrl = null;
        resetNarration();
    }

    // Autoplay the first time we get a narration blob.
    $effect(() => {
        if (!audioUrl || !audioPlayer || autoPlayedUrl === audioUrl) return;
        autoPlayedUrl = audioUrl;
        audioPlayer.play().catch(() => {
            /* Browser may block autoplay until a tap — controls stay visible. */
        });
    });

    async function loadNarration(attemptKey) {
        const round = gameState?.roundIndex ?? -1;
        if (!password || !code || round < 0) return;
        audioLoading = true;
        audioError = "";
        if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
        try {
            const { ok, blob } = await api.fetchStoryAudio(password, code, round);
            if (!ok || !blob) {
                audioError = "Narration didn't load — give it a moment, or tap Retry.";
                return;
            }
            audioUrl = URL.createObjectURL(blob);
            narrationAttempted = attemptKey;
        } catch {
            audioError = "Narration failed to load — check your connection and retry.";
        } finally {
            audioLoading = false;
        }
    }

    async function retryNarration() {
        narrationAttempted = "";
        if (!gameState?.storyAudioReady) await onRequestTts?.();
        const round = gameState?.roundIndex ?? -1;
        const key = code && round >= 0 ? `${code}:${round}` : "";
        if (key) loadNarration(key);
    }

    // Auto-load once the server reports the audio is ready.
    $effect(() => {
        const round = gameState?.roundIndex ?? -1;
        const key = code && round >= 0 ? `${code}:${round}` : "";
        if (!key || !password || !gameState?.storyAudioReady) return;
        if (narrationAttempted === key && audioUrl) return;
        loadNarration(key);
    });

    function onPlay() { narration.playing = true; }
    function onPause() { narration.playing = false; }
    function onEnded() { narration.playing = false; }
    function onTimeUpdate() {
        if (!audioPlayer) return;
        narration.currentTime = audioPlayer.currentTime;
        narration.duration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
    }

    onDestroy(releaseAudio);
</script>

<div class="narration-panel {compact ? 'compact' : ''}" aria-label="Story narration">
    {#if audioUrl}
        <audio
            bind:this={audioPlayer}
            class="story-audio-player"
            controls
            preload="auto"
            src={audioUrl}
            onplay={onPlay}
            onpause={onPause}
            onended={onEnded}
            ontimeupdate={onTimeUpdate}
        ></audio>
        {#if !compact}
            <p class="hint narration-hint">▶ Press play to hear it read aloud — the story scrolls along — or read it yourself below.</p>
        {/if}
    {:else if audioError}
        <p class="error narration-status">{audioError}</p>
        <button type="button" class="ghost" onclick={retryNarration} disabled={busy}>Retry narration</button>
    {:else if audioLoading || gameState?.storyAudioReady}
        <p class="narration-status muted">Loading narration…</p>
    {:else if gameState?.narrationPending || gameState?.imagesPending}
        {#if !compact}<div class="spinner sm"></div>{/if}
        <p class="narration-status muted">
            {#if gameState?.narrationPending && gameState?.imagesPending}
                Putting your story together — recording the narration and drawing the scenes…
            {:else if gameState?.narrationPending}
                Recording the narration… (a moment longer on big stories)
            {:else}
                Almost ready — drawing the scene illustrations…
            {/if}
        </p>
    {:else}
        <button type="button" class="primary narration-load" onclick={retryNarration} disabled={busy}>Play narration</button>
    {/if}
</div>
