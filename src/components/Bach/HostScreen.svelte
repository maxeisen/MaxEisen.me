<!--
    Host (big-screen) view. Drives the whole room: setup, lobby + QR, round
    controls, the story reveal, MVP voting, and the leaderboard.
    All mutations go through the callbacks passed from Bach.svelte.
-->
<script>
    import { onDestroy } from "svelte";
    import "./lib/bach.css";
    import HostBar from "./host/HostBar.svelte";
    import WritingScreen from "./host/WritingScreen.svelte";
    import GeneratingScreen from "./host/GeneratingScreen.svelte";
    import ResultsScreen from "./host/ResultsScreen.svelte";
    import FinishedScreen from "./host/FinishedScreen.svelte";
    import SetupScreen from "./host/SetupScreen.svelte";
    import LobbyScreen from "./host/LobbyScreen.svelte";
    import * as api from "./lib/api.js";
    import { formatStory, buildStoryBlocks } from "./lib/story.js";
    import {
        drawPrompts,
        loadUsedPrompts,
        saveUsedPrompts,
        clearUsedPrompts,
        poolsForAudience,
        defaultPoolForRound,
    } from "./lib/partyConfig.js";
    import { validatePartyPack } from "./lib/validatePartyPack.js";

    let {
        party,
        partyCatalog = { packs: [], activePackId: null, source: null },
        code,
        password,
        gameState,
        netError,
        onCreate,
        onSelectPartyPack,
        onReloadPartyPack,
        onPartyPackUpload,
        onRequestTts,
        onRequestImages,
        onAction,
        onGenerate,
    } = $props();

    const allPools = $derived(party.pools);
    const defaultSlots = $derived(party.slotsPerPlayer);

    /** @type {"boys" | "everyone"} */
    let roundAudience = $state("boys");
    const pools = $derived(poolsForAudience(allPools, roundAudience));
    const hasNoMercyBoys = $derived(allPools.some((p) => p.id === "no-mercy"));
    const showNoMercyBoys = $derived(pools.some((p) => p.id === "no-mercy"));

    const packOptions = $derived(
        partyCatalog.packs.length > 0
            ? partyCatalog.packs
            : party?.id
                ? [{ id: party.id, title: party.title || party.id }]
                : [],
    );

    // --- Setup (pre-session) ---
    let facts = $state("");
    let storyTone = $state("");
    let creating = $state(false);

    $effect(() => {
        if (code || !party) return;
        if (party.defaultFacts && !facts) facts = party.defaultFacts;
        if (party.storyTone && !storyTone) storyTone = party.storyTone;
    });
    let usedPrompts = $state(new Set());
    let packError = $state("");
    let packStatus = $state("");
    let packUploading = $state(false);
    let packSelecting = $state(false);

    // --- Round config ---
    let selectedPool = $state("");
    let slots = $state(3);
    /** @type {string | null} */
    let lobbyDefaultsForPackId = $state(null);

    $effect(() => {
        const packId = party?.id;
        if (!packId || lobbyDefaultsForPackId === packId) return;
        lobbyDefaultsForPackId = packId;
        roundAudience = party.defaultRoundAudience === "everyone" ? "everyone" : "boys";
        const nextPools = poolsForAudience(allPools, roundAudience);
        selectedPool = defaultPoolForRound(party, nextPools, roundAudience);
    });

    $effect(() => {
        if (!pools.length) return;
        slots = defaultSlots;
        const pick = defaultPoolForRound(party, pools, roundAudience);
        if (!selectedPool || !pools.some((p) => p.id === selectedPool)) {
            selectedPool = pick;
        }
    });

    function onAudienceChange(next) {
        roundAudience = next;
        selectedPool = defaultPoolForRound(party, poolsForAudience(allPools, next), next);
    }
    let busy = $state(false);
    let storyTextVisible = $state(false);
    let storyRevealKey = $state("");
    /** @type {HTMLDivElement | null} */
    let storyScrollEl = $state(null);
    let followNarrationScroll = $state(true);
    /** Per-narrated-segment scroll anchors, recomputed on resize/image-load. */
    let scrollSegments = null; // [{ start, chars, targetY }] in document coords
    let scrollTotalChars = 0;
    let scrollMaxY = 0;
    let scrollTarget = 0;
    let scrollRaf = 0;
    let scrollResizeObserver = null;

    let audioUrl = $state(null);
    let audioLoading = $state(false);
    let audioError = $state("");
    let audioPlayer = $state(null);
    /** Object URL we already auto-played (avoid replay on re-bind). */
    let autoPlayedUrl = $state(null);
    /** Round we already tried to fetch narration for (prevents 404 retry loops). */
    let narrationAttempted = $state("");

    /** @type {Record<number, string>} */
    let imageUrls = $state({});
    let imagesLoading = $state(false);
    /** Round key images were fetched for; avoids effect ↔ releaseImages loops. */
    let imagesFetchKey = $state("");
    let imagesRoundKey = $state("");

    $effect(() => {
        if (code) usedPrompts = loadUsedPrompts(code);
    });

    const phase = $derived(gameState?.phase ?? null);
    const players = $derived(gameState?.players ?? []);
    const counts = $derived(gameState?.counts ?? { submitted: 0, total: 0 });
    const leaderboard = $derived(gameState?.leaderboard ?? []);

    const joinUrl = $derived(
        typeof window !== "undefined" && code
            ? `${window.location.origin}/bach?room=${code}&k=${encodeURIComponent(password)}`
            : ""
    );
    const joinPathManual = $derived(
        typeof window !== "undefined" && code
            ? `${window.location.host}/bach?room=${code}`
            : ""
    );
    // Split the raw text into its own derived so formatStory/buildStoryBlocks
    // only re-run when the story string actually changes — not on every poll,
    // which replaces gameState wholesale every 1.5s.
    const storyText = $derived(gameState?.story || "");
    const story = $derived(formatStory(storyText));
    const imagePlacements = $derived(gameState?.storyImagePlacements ?? []);
    const storyBlocks = $derived(buildStoryBlocks(story.paragraphs, imagePlacements, imageUrls));

    $effect(() => {
        const key = code && (gameState?.roundIndex ?? -1) >= 0
            ? `${code}:${gameState.roundIndex}`
            : "";
        if (phase === "reveal" && key && key !== storyRevealKey) {
            storyRevealKey = key;
            storyTextVisible = false;
            followNarrationScroll = true;
        }
    });

    function releaseImages() {
        const urls = Object.values(imageUrls);
        if (!urls.length && !imagesLoading && !imagesFetchKey && !imagesRoundKey) return;
        for (const url of urls) URL.revokeObjectURL(url);
        if (urls.length) imageUrls = {};
        imagesLoading = false;
        imagesFetchKey = "";
        imagesRoundKey = "";
    }

    function releaseAudio() {
        audioPlayer?.pause();
        audioPlayer = null;
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            audioUrl = null;
        }
        audioLoading = false;
        audioError = "";
        narrationAttempted = "";
        autoPlayedUrl = null;
        resumeAt = 0;
        resumePlaying = false;
    }

    // Playback bookkeeping so narration survives the <audio> element being
    // remounted across phase changes (reveal → voting renders a fresh element,
    // which would otherwise reset to 0 and stop). Plain vars, not $state — the
    // effect below should only re-run when the element/url changes.
    let resumeAt = 0;
    let resumePlaying = false;

    $effect(() => {
        if (!audioUrl || !audioPlayer) return;
        const el = audioPlayer;
        if (autoPlayedUrl !== audioUrl) {
            // First time we've seen this narration: autoplay from the top.
            autoPlayedUrl = audioUrl;
            el.play().catch(() => {
                /* Browser may block autoplay until a tap — controls stay visible. */
            });
        } else if (el.paused) {
            // Same narration, freshly remounted element (phase change): restore
            // position and keep playing if it was playing before.
            if (resumeAt > 0) { try { el.currentTime = resumeAt; } catch {} }
            if (resumePlaying) el.play().catch(() => {});
        }
    });

    function prefersReducedMotion() {
        return typeof window !== "undefined" && typeof window.matchMedia === "function"
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    async function loadNarration(attemptKey) {
        const round = gameState?.roundIndex ?? -1;
        if (!password || !code || round < 0) return;

        audioLoading = true;
        audioError = "";
        resumeAt = 0;
        resumePlaying = false;
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            audioUrl = null;
        }

        try {
            const { ok, blob } = await api.fetchStoryAudio(password, code, round);
            if (!ok || !blob) {
                audioError = ok === false && !blob
                    ? "Narration isn't ready yet — wait a moment, or tap Retry recording."
                    : "Narration is not available — try Retry recording or Regenerate.";
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
        if (!gameState?.storyAudioReady) {
            await onRequestTts?.();
        }
        const round = gameState?.roundIndex ?? -1;
        const key = code && round >= 0 ? `${code}:${round}` : "";
        if (key) loadNarration(key);
    }

    const LISTEN_PHASES = ["reveal", "voting", "results"];

    $effect(() => {
        const round = gameState?.roundIndex ?? -1;
        const key = code && round >= 0 ? `${code}:${round}` : "";

        if (!LISTEN_PHASES.includes(phase) || !key || !password) {
            if (phase === "finished" || phase === "lobby" || phase === "writing" || !code) {
                releaseAudio();
            }
            return;
        }

        if (!gameState?.storyAudioReady) return;
        if (narrationAttempted === key && audioUrl) return;

        loadNarration(key);
    });

    async function loadStoryImages(roundKey, placements, readyIds) {
        const round = gameState?.roundIndex ?? -1;
        if (!password || !code || round < 0 || !placements.length || !readyIds?.length) return false;

        imagesLoading = true;
        try {
            const next = { ...imageUrls };
            for (const slot of placements) {
                const id = Number(slot.id);
                if (next[id] || !readyIds.includes(id)) continue;
                const { ok, blob } = await api.fetchStoryImage(password, code, round, id);
                if (ok && blob) next[id] = URL.createObjectURL(blob);
            }
            imageUrls = next;
            const allLoaded = readyIds.every((rid) => next[rid]);
            if (allLoaded) {
                imagesRoundKey = roundKey;
                imagesFetchKey = `${roundKey}:${readyIds.join(",")}`;
            } else {
                imagesFetchKey = "";
            }
            return allLoaded;
        } finally {
            imagesLoading = false;
        }
    }

    $effect(() => {
        const round = gameState?.roundIndex ?? -1;
        const key = code && round >= 0 ? `${code}:${round}` : "";
        const placements = gameState?.storyImagePlacements ?? [];

        if (!LISTEN_PHASES.includes(phase) || !key || !password) {
            if (
                (phase === "finished" || phase === "lobby" || phase === "writing" || !code)
                && (imagesRoundKey || imagesFetchKey || Object.keys(imageUrls).length)
            ) {
                releaseImages();
            }
            return;
        }

        if (key !== imagesRoundKey && imagesRoundKey) {
            releaseImages();
        }

        if (!placements.length || gameState?.imagesPending) return;

        const readyIds = gameState?.readyImageIds ?? [];
        const fetchKey = `${key}:${readyIds.join(",")}`;
        const allLoaded = readyIds.length > 0 && readyIds.every((rid) => imageUrls[rid]);
        if (allLoaded) {
            imagesFetchKey = fetchKey;
            imagesRoundKey = key;
            return;
        }

        if (imagesLoading || !readyIds.length) return;
        void loadStoryImages(key, placements, readyIds);
    });

    // Re-fetch when more blobs appear on the server (poll updates readyImageIds).
    $effect(() => {
        const placements = gameState?.storyImagePlacements ?? [];
        const readyIds = gameState?.readyImageIds ?? [];
        if (!LISTEN_PHASES.includes(phase) || !placements.length || imagesLoading) return;
        if (gameState?.imagesPending || !readyIds.length) return;
        const key = code && (gameState?.roundIndex ?? -1) >= 0
            ? `${code}:${gameState.roundIndex}`
            : "";
        const missing = readyIds.some((id) => !imageUrls[id]);
        if (key && missing) void loadStoryImages(key, placements, readyIds);
    });

    function onNarrationPlay() {
        resumePlaying = true;
        storyTextVisible = true;
        followNarrationScroll = true;
    }

    function onNarrationPause() {
        resumePlaying = false;
        if (audioPlayer) resumeAt = audioPlayer.currentTime;
    }

    function onNarrationEnded() {
        resumePlaying = false;
        resumeAt = 0;
    }

    // Observe the story body so geometry is cached (and refreshed when lazy
    // images load / the window resizes) instead of read on every timeupdate.
    $effect(() => {
        if (!storyScrollEl) return;
        recomputeScrollGeom();
        const onResize = () => recomputeScrollGeom();
        window.addEventListener("resize", onResize);
        if (typeof ResizeObserver !== "undefined") {
            scrollResizeObserver = new ResizeObserver(() => recomputeScrollGeom());
            scrollResizeObserver.observe(storyScrollEl);
        }
        return () => {
            window.removeEventListener("resize", onResize);
            scrollResizeObserver?.disconnect();
            scrollResizeObserver = null;
        };
    });

    // Build a scroll anchor per narrated segment (title, then each paragraph),
    // weighted by its character count and anchored to the real DOM element's
    // document position. Narration speaks only the text, so weighting by chars
    // (not pixel height) keeps the scroll in step with the voice, and anchoring
    // to paragraph elements means illustrations between paragraphs are simply
    // scrolled past — their height never distorts the mapping, even as they
    // lazy-load (a load just re-runs this via the ResizeObserver).
    function recomputeScrollGeom() {
        if (!storyScrollEl) { scrollSegments = null; return; }
        const vh = window.innerHeight;
        const docY = (el) => el.getBoundingClientRect().top + window.scrollY;
        const segs = [];
        const titleEl = storyScrollEl.parentElement?.querySelector(".story-title");
        if (titleEl) segs.push({ chars: Math.max(1, titleEl.textContent.length), targetY: 0 });
        for (const p of storyScrollEl.querySelectorAll(":scope > p")) {
            segs.push({
                chars: Math.max(1, p.textContent.length),
                targetY: Math.max(0, docY(p) - vh * 0.3),
            });
        }
        if (!segs.length) { scrollSegments = null; return; }
        let acc = 0;
        for (const s of segs) { s.start = acc; acc += s.chars; }
        scrollTotalChars = acc;
        scrollMaxY = Math.max(0, document.documentElement.scrollHeight - vh);
        scrollSegments = segs;
    }

    function scrollTick() {
        scrollRaf = 0;
        const cur = window.scrollY;
        const delta = scrollTarget - cur;
        const next = Math.abs(delta) < 0.5 ? scrollTarget : cur + delta * 0.12;
        window.scrollTo(0, next);
        if (Math.abs(scrollTarget - window.scrollY) > 1) {
            scrollRaf = requestAnimationFrame(scrollTick);
        }
    }

    function onNarrationTimeUpdate() {
        if (audioPlayer) resumeAt = audioPlayer.currentTime;
        if (!followNarrationScroll || !audioPlayer || !storyScrollEl || !storyTextVisible) return;
        if (prefersReducedMotion()) return; // don't yank the page for reduced-motion users
        const d = audioPlayer.duration;
        if (!d || !Number.isFinite(d) || d <= 0) return;
        if (!scrollSegments) recomputeScrollGeom();
        if (!scrollSegments || !scrollTotalChars) return;
        const progress = Math.min(1, Math.max(0, audioPlayer.currentTime / d));
        const charPos = progress * scrollTotalChars;
        let i = 0;
        while (i < scrollSegments.length - 1 && charPos >= scrollSegments[i + 1].start) i++;
        const seg = scrollSegments[i];
        const f = Math.min(1, Math.max(0, (charPos - seg.start) / seg.chars));
        const nextY = scrollSegments[i + 1]?.targetY ?? scrollMaxY;
        scrollTarget = Math.min(scrollMaxY, seg.targetY + (nextY - seg.targetY) * f);
        if (!scrollRaf) scrollRaf = requestAnimationFrame(scrollTick);
    }

    function onStoryScrollUser() {
        followNarrationScroll = false;
        if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = 0; }
    }

    onDestroy(() => {
        releaseAudio();
        releaseImages();
        cancelAnimationFrame(scrollRaf);
        scrollResizeObserver?.disconnect();
    });

    function selectedPackId() {
        return partyCatalog.activePackId || packOptions[0]?.id || "";
    }

    async function onPackSelect(e) {
        const packId = e.currentTarget.value;
        if (!packId || packId === partyCatalog.activePackId) return;
        packError = "";
        packStatus = "";
        packSelecting = true;
        try {
            const loaded = await onSelectPartyPack(packId);
            const entry = partyCatalog.packs.find((p) => p.id === packId);
            packStatus = `Using “${entry?.title || packId}”.`;
            if (loaded?.defaultFacts && !facts) facts = loaded.defaultFacts;
            if (loaded?.storyTone && !storyTone) storyTone = loaded.storyTone;
        } catch (err) {
            packError = err?.message || "Could not switch party pack.";
            e.currentTarget.value = partyCatalog.activePackId || "";
        } finally {
            packSelecting = false;
        }
    }

    async function onPackReload() {
        const packId = selectedPackId();
        if (!packId) return;
        packError = "";
        packStatus = "";
        packSelecting = true;
        try {
            const loaded = await onReloadPartyPack(packId);
            const entry = partyCatalog.packs.find((p) => p.id === packId);
            packStatus = `Reloaded “${entry?.title || packId}” from the server.`;
            if (loaded?.defaultFacts) facts = loaded.defaultFacts;
            if (loaded?.storyTone) storyTone = loaded.storyTone;
        } catch (err) {
            packError = err?.message || "Could not reload party pack.";
        } finally {
            packSelecting = false;
        }
    }

    async function onPackFileSelect(e) {
        const file = e.currentTarget.files?.[0];
        e.currentTarget.value = "";
        if (!file) return;
        packError = "";
        packStatus = "";
        packUploading = true;
        try {
            const text = await file.text();
            const raw = JSON.parse(text);
            const problem = validatePartyPack(raw);
            if (problem) {
                packError = problem;
                return;
            }
            await onPartyPackUpload(raw);
            packStatus = `Loaded “${raw.title || raw.id || file.name}”.`;
            if (raw.defaultFacts && !facts) facts = raw.defaultFacts;
            if (raw.storyTone && !storyTone) storyTone = raw.storyTone;
        } catch (err) {
            packError = err instanceof SyntaxError
                ? "Invalid JSON — check the file format."
                : (err?.message || "Upload failed.");
        } finally {
            packUploading = false;
        }
    }

    async function create() {
        creating = true;
        try { await onCreate(facts, storyTone); } finally { creating = false; }
    }

    async function startRound() {
        // The number input's min/max are only hints — clamp before using it so a
        // cleared or fat-fingered value can't start a round with 0 (or a huge
        // number of) prompts per player.
        const n = Math.min(6, Math.max(1, Math.round(Number(slots)) || 3));
        slots = n;
        const pool = pools.find((p) => p.id === selectedPool) || pools[0];
        const need = Math.max(1, players.length) * n;
        const drawn = drawPrompts(pool, usedPrompts, need);
        if (code) saveUsedPrompts(code, usedPrompts);
        busy = true;
        try {
            await onAction("start", {
                prompts: drawn,
                slotsPerPlayer: n,
                swapPool: pool.prompts,
            });
        } finally { busy = false; }
    }

    async function act(action) {
        busy = true;
        try {
            const ok = await onAction(action);
            if (ok && action === "reset") {
                usedPrompts = new Set();
                if (code) clearUsedPrompts(code);
            }
        } finally { busy = false; }
    }

    async function generate() {
        busy = true;
        storyTextVisible = false;
        try { await onGenerate(); } finally { busy = false; }
    }
</script>

<div class="host">
    {#if !code}
        <SetupScreen
            {party}
            {packOptions}
            {partyCatalog}
            {packSelecting}
            {packUploading}
            {packError}
            {packStatus}
            {creating}
            bind:facts
            bind:storyTone
            {onPackSelect}
            {onPackReload}
            {onPackFileSelect}
            onCreate={create}
        />
    {:else}
        <HostBar {code} {leaderboard} {busy} onReset={() => act("reset")} />

        {#if phase === "lobby"}
            <LobbyScreen
                {party}
                {partyCatalog}
                {packOptions}
                {code}
                {password}
                {players}
                {joinUrl}
                {joinPathManual}
                {packSelecting}
                {packUploading}
                {packError}
                {packStatus}
                {roundAudience}
                {pools}
                {hasNoMercyBoys}
                {showNoMercyBoys}
                {busy}
                bind:selectedPool
                bind:slots
                {onPackSelect}
                {onPackReload}
                {onPackFileSelect}
                {onAudienceChange}
                onStartRound={startRound}
            />


        {:else if phase === "writing"}
            <WritingScreen {players} {counts} error={gameState?.error} {busy} onGenerate={generate} />

        {:else if phase === "generating"}
            <GeneratingScreen {busy} onAbort={() => act("abortGenerating")} />

        {:else if phase === "reveal"}
            <section class="reveal">
                <div class="narration-panel" aria-label="Story narration">
                    <h3 class="mini-title">Narration</h3>
                    <p class="hint narration-optional-hint">Optional — when it plays, the story scrolls along. You can still reveal text manually anytime.</p>
                    {#if gameState?.imagesPending}
                        <p class="narration-status muted">Drawing scene illustrations… usually a couple of minutes.</p>
                    {:else if gameState?.imagesError}
                        <p class="error narration-status">
                            {gameState.imagesError === "images_partial"
                                ? "Some illustrations didn't finish — retry or reveal the story anyway."
                                : "Illustrations didn't generate."}
                        </p>
                        <button
                            type="button"
                            class="ghost"
                            onclick={() => {
                                imagesFetchKey = "";
                                onRequestImages?.(true);
                            }}
                            disabled={busy}
                        >
                            Retry illustrations
                        </button>
                    {:else if imagePlacements.length && imagesLoading}
                        <p class="narration-status muted">Loading illustrations…</p>
                    {/if}
                    {#if audioUrl}
                        <!-- Keep player mounted whenever we have a loaded blob (don't unmount on poll flicker). -->
                        <audio
                            bind:this={audioPlayer}
                            class="story-audio-player"
                            controls
                            preload="auto"
                            src={audioUrl}
                            onplay={onNarrationPlay}
                            onpause={onNarrationPause}
                            onended={onNarrationEnded}
                            ontimeupdate={onNarrationTimeUpdate}
                        ></audio>
                    {:else if audioLoading}
                        <p class="narration-status muted">Loading audio…</p>
                    {:else if gameState?.narrationPending}
                        <p class="narration-status muted">Recording audio… can take a minute on long stories. Feel free to reveal the text below anytime.</p>
                        <button type="button" class="ghost" onclick={() => onRequestTts()} disabled={busy}>
                            Retry recording
                        </button>
                    {:else if !gameState?.storyAudioReady}
                        <button type="button" class="primary big narration-load" onclick={retryNarration} disabled={busy}>
                            Load narration
                        </button>
                        {#if audioError}
                            <p class="error narration-status">{audioError}</p>
                            <button type="button" class="ghost" onclick={retryNarration} disabled={busy}>Retry</button>
                        {:else}
                            <p class="narration-status muted">Narration didn't generate — tap Retry recording or Regenerate.</p>
                            <button type="button" class="ghost" onclick={() => onRequestTts()} disabled={busy}>
                                Retry recording
                            </button>
                        {/if}
                    {:else}
                        <button type="button" class="primary big narration-load" onclick={retryNarration} disabled={busy}>
                            Load narration
                        </button>
                        {#if audioError}
                            <p class="error narration-status">{audioError}</p>
                            <button type="button" class="ghost" onclick={retryNarration} disabled={busy}>Retry</button>
                        {/if}
                    {/if}
                </div>
                <div class="story-reveal-controls">
                    {#if storyTextVisible}
                        <button type="button" class="ghost story-reveal-btn" onclick={() => (storyTextVisible = false)}>
                            Hide story text
                        </button>
                    {:else}
                        <p class="hint story-hidden-hint">Story’s ready with scene illustrations woven in. Hit play on narration to auto-scroll, or reveal text whenever you like.</p>
                        <button type="button" class="primary story-reveal-btn" onclick={() => (storyTextVisible = true)}>
                            Show the story
                        </button>
                    {/if}
                </div>
                {#if storyTextVisible}
                    {#if story.title}<h2 class="story-title">{story.title}</h2>{/if}
                    <div
                        class="story-body"
                        bind:this={storyScrollEl}
                        onwheel={onStoryScrollUser}
                        ontouchmove={onStoryScrollUser}
                    >
                        {#each storyBlocks as block}
                            {#if block.type === "paragraph"}
                                <p>{@html block.html}</p>
                            {:else}
                                <figure class="story-illustration">
                                    {#if block.url}
                                        <img src={block.url} alt={block.caption || "Story moment"} loading="lazy" />
                                    {:else if gameState?.imagesPending}
                                        <div class="story-img-placeholder" aria-hidden="true">Drawing this moment…</div>
                                    {:else}
                                        <div class="story-img-placeholder missed" aria-hidden="true">Illustration unavailable</div>
                                    {/if}
                                    {#if block.caption}
                                        <figcaption>{block.caption}</figcaption>
                                    {/if}
                                </figure>
                            {/if}
                        {/each}
                    </div>
                {/if}
                <div class="reveal-actions">
                    <button class="ghost" onclick={generate} disabled={busy}>↻ Regenerate</button>
                    <button class="primary" onclick={() => act("openVoting")} disabled={busy}>Open MVP voting →</button>
                </div>
            </section>

        {:else if phase === "voting"}
            <section class="centered">
                {#if audioUrl}
                    <div class="narration-panel compact" aria-label="Story narration">
                        <audio
                            bind:this={audioPlayer}
                            class="story-audio-player"
                            controls
                            preload="auto"
                            src={audioUrl}
                            onplay={onNarrationPlay}
                            onpause={onNarrationPause}
                            onended={onNarrationEnded}
                            ontimeupdate={onNarrationTimeUpdate}
                        ></audio>
                    </div>
                {/if}
                <h2 class="display sm">Vote for round MVP</h2>
                <p class="muted">Open your phone and crown the best contribution. {gameState?.voteCount ?? 0} / {players.length} voted.</p>
                <ul class="ballot-preview">
                    {#each gameState?.ballot ?? [] as item}
                        <li><span class="ballot-prompt">{item.prompt}</span> “{item.value}”</li>
                    {/each}
                </ul>
                <button class="primary big" onclick={() => act("tally")} disabled={busy}>Reveal the MVP</button>
            </section>

        {:else if phase === "results"}
            <ResultsScreen mvp={gameState?.mvp} {leaderboard} {players} {busy} onFinish={() => act("finish")} onNextRound={startRound} />

        {:else if phase === "finished"}
            <FinishedScreen {leaderboard} {busy} onReset={() => act("reset")} />
        {/if}
    {/if}

    {#if netError}<div class="net-note">{netError}</div>{/if}
</div>
