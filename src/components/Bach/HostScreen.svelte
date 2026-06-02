<!--
    Host (big-screen) view. Drives the whole room: setup, lobby + QR, round
    controls, the story reveal, MVP voting, and the leaderboard.
    All mutations go through the callbacks passed from Bach.svelte.
-->
<script>
    import { onDestroy } from "svelte";
    import Qr from "./Qr.svelte";
    import * as api from "./api.js";
    import { formatStory } from "./story.js";
    import {
        drawPrompts,
        loadUsedPrompts,
        saveUsedPrompts,
        clearUsedPrompts,
        hasPrivatePartyPack,
    } from "./partyConfig.js";
    import { validatePartyPack } from "./validatePartyPack.js";

    let { party, code, password, gameState, netError, onCreate, onPartyPackUpload, onAction, onGenerate } = $props();

    const pools = $derived(party.pools);
    const defaultSlots = $derived(party.slotsPerPlayer);

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

    // --- Round config ---
    let selectedPool = $state("");
    let slots = $state(3);

    $effect(() => {
        if (!pools.length) return;
        if (!pools.some((p) => p.id === selectedPool)) selectedPool = pools[0].id;
        slots = defaultSlots;
    });
    let busy = $state(false);

    let audioUrl = $state(null);
    let audioLoading = $state(false);
    let audioError = $state("");
    let audioEl = $state(null);
    let playing = $state(false);
    let audioLoadKey = $state("");

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
    const story = $derived(formatStory(gameState?.story || ""));

    function releaseAudio() {
        if (audioEl) {
            audioEl.pause();
            audioEl = null;
        }
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            audioUrl = null;
        }
        playing = false;
        audioLoading = false;
        audioError = "";
        audioLoadKey = "";
    }

    $effect(() => {
        const p = phase;
        const round = gameState?.roundIndex ?? -1;
        const ver = gameState?.version ?? 0;
        const ready = gameState?.storyAudioReady;
        const key = code && round >= 0 ? `${code}:${round}:${ver}` : "";

        if (p !== "reveal" || !ready || !key || !password) {
            releaseAudio();
            return;
        }
        if (key === audioLoadKey) return;

        let cancelled = false;
        releaseAudio();
        audioLoadKey = key;
        audioLoading = true;

        (async () => {
            const { ok, blob } = await api.fetchStoryAudio(password, code, round);
            if (cancelled) return;
            audioLoading = false;
            if (!ok || !blob) {
                audioError = "Narration didn't load — try regenerating.";
                audioLoadKey = "";
                return;
            }
            audioUrl = URL.createObjectURL(blob);
            audioEl = new Audio(audioUrl);
            audioEl.addEventListener("ended", () => { playing = false; });
            audioEl.addEventListener("pause", () => { playing = false; });
            audioEl.addEventListener("play", () => { playing = true; });
        })();

        return () => { cancelled = true; };
    });

    onDestroy(releaseAudio);

    function toggleNarration() {
        if (!audioEl || audioLoading) return;
        if (playing) audioEl.pause();
        else audioEl.play().catch(() => { audioError = "Tap play to start audio."; });
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
        const pool = pools.find((p) => p.id === selectedPool) || pools[0];
        const need = Math.max(1, players.length) * slots;
        const drawn = drawPrompts(pool, usedPrompts, need);
        if (code) saveUsedPrompts(code, usedPrompts);
        busy = true;
        try {
            await onAction("start", { prompts: drawn, slotsPerPlayer: slots });
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
        try { await onGenerate(); } finally { busy = false; }
    }
</script>

<div class="host">
    {#if !code}
        <!-- Setup: collect couple facts, then create the session. -->
        <section class="setup">
            <h1 class="display">{party.title}</h1>
            <p class="lede">Guests fill in prompts on their phones; AI weaves their answers into one story. Upload your private party pack JSON, then add context and tone below.</p>

            <div class="pack-upload">
                <label class="field-label" for="party-pack-file">Party pack (JSON)</label>
                <p class="pack-hint">
                    {#if hasPrivatePartyPack()}
                        Using custom pack: <strong>{party.title}</strong>
                        {#if party.id} <span class="muted">({party.id})</span>{/if}
                    {:else}
                        Using built-in default prompts. Upload your own <code>*.json</code> pack to replace them.
                    {/if}
                </p>
                <input
                    id="party-pack-file"
                    type="file"
                    accept="application/json,.json"
                    disabled={packUploading}
                    onchange={onPackFileSelect}
                />
                {#if packUploading}<p class="muted">Uploading…</p>{/if}
                {#if packStatus}<p class="pack-ok">{packStatus}</p>{/if}
                {#if packError}<p class="error">{packError}</p>{/if}
            </div>

            <label class="field-label" for="facts">Story context (couple, party, inside jokes)</label>
            <textarea
                id="facts"
                bind:value={facts}
                rows="6"
                placeholder="Names, how they met, running jokes, topics to avoid, people not to call out…"
            ></textarea>
            <label class="field-label" for="story-tone">Story tone (optional)</label>
            <textarea
                id="story-tone"
                bind:value={storyTone}
                rows="2"
                maxlength="500"
                placeholder="e.g. silly, heartfelt, PG, spooky — whatever fits your group"
            ></textarea>
            <button class="primary big" onclick={create} disabled={creating}>
                {creating ? "Starting…" : "Start a session"}
            </button>
            <p class="hint">You can update context later from the lobby if needed.</p>
        </section>
    {:else}
        <header class="bar">
            <div class="bar-code">
                <span class="bar-code-label">Room</span>
                <span class="bar-code-value">{code}</span>
            </div>
            {#if leaderboard.length > 0}
                <div class="bar-leader">
                    <span class="bar-code-label">Round leader</span>
                    <span class="bar-leader-name">{leaderboard[0].name} · {leaderboard[0].points}</span>
                </div>
            {/if}
            <button class="ghost small" onclick={() => act("reset")} disabled={busy}>New game</button>
        </header>

        {#if phase === "lobby"}
            <section class="lobby">
                <div class="lobby-join">
                    <h2 class="section-title">Join the game</h2>
                    {#if joinUrl}<Qr text={joinUrl} size={260} />{/if}
                    <p class="join-hint">
                        Scan the QR, or open <strong>{joinPathManual}</strong> and enter the join password below.
                    </p>
                    <div class="join-manual">
                        <div class="join-manual-row">
                            <span class="join-manual-label">Room code</span>
                            <span class="bigcode inline">{code}</span>
                        </div>
                        <div class="join-manual-row">
                            <span class="join-manual-label">Join password</span>
                            <span class="join-pw">{password}</span>
                        </div>
                    </div>
                </div>
                <div class="lobby-side">
                    <h2 class="section-title">Players ({players.length})</h2>
                    {#if players.length === 0}
                        <p class="muted">Waiting for the first player to join…</p>
                    {:else}
                        <ul class="player-list">
                            {#each players as p}
                                <li>{p.name}</li>
                            {/each}
                        </ul>
                    {/if}

                    <div class="round-setup pack-upload compact">
                        <h3 class="mini-title">Party pack</h3>
                        <p class="pack-hint">
                            {#if hasPrivatePartyPack()}
                                <strong>{party.title}</strong>
                            {:else}
                                Default prompts
                            {/if}
                            — <label class="pack-replace" for="party-pack-file-lobby">replace JSON</label>
                        </p>
                        <input
                            id="party-pack-file-lobby"
                            type="file"
                            accept="application/json,.json"
                            class="sr-only"
                            disabled={packUploading}
                            onchange={onPackFileSelect}
                        />
                        {#if packStatus}<p class="pack-ok">{packStatus}</p>{/if}
                        {#if packError}<p class="error">{packError}</p>{/if}
                    </div>

                    <div class="round-setup">
                        <h3 class="mini-title">Round flavour</h3>
                        <div class="pool-buttons">
                            {#each pools as pool}
                                <button
                                    class="pool-btn {selectedPool === pool.id ? 'on' : ''}"
                                    onclick={() => (selectedPool = pool.id)}
                                >{pool.label}</button>
                            {/each}
                        </div>
                        <label class="slots-row">
                            Words per person
                            <input type="number" min="1" max="6" bind:value={slots} />
                        </label>
                        <button class="primary big" onclick={startRound} disabled={busy || players.length === 0}>
                            {busy ? "Dealing prompts…" : "Start the round"}
                        </button>
                        {#if players.length === 0}<p class="hint">Need at least one player.</p>{/if}
                    </div>
                </div>
            </section>

        {:else if phase === "writing"}
            <section class="centered">
                <h2 class="display sm">Fill in the blanks on your phones…</h2>
                <div class="progress-big">{counts.submitted} / {counts.total} done</div>
                <ul class="chip-list">
                    {#each players as p}
                        <li class="chip {p.submitted ? 'done' : ''}">{p.name}{p.submitted ? " ✓" : "…"}</li>
                    {/each}
                </ul>
                {#if gameState?.error === "generation_failed"}
                    <p class="error">The story machine choked. Try weaving again.</p>
                {/if}
                <button class="primary big" onclick={generate} disabled={busy || counts.total === 0}>
                    {busy ? "Weaving…" : counts.submitted < counts.total ? "Weave it anyway" : "Weave the story"}
                </button>
                <p class="hint">Waiting on stragglers? You can weave whenever you like.</p>
            </section>

        {:else if phase === "generating"}
            <section class="centered">
                <div class="spinner"></div>
                <h2 class="display sm">Writing your story…</h2>
                <p class="muted">Weaving the story and recording the British narrator — hang tight.</p>
            </section>

        {:else if phase === "reveal"}
            <section class="reveal">
                {#if gameState?.storyAudioReady && audioLoading}
                    <div class="centered reveal-wait">
                        <div class="spinner"></div>
                        <p class="muted">Story's ready — loading the narrator…</p>
                    </div>
                {:else}
                <div class="narration-bar">
                    {#if audioUrl}
                        <button type="button" class="primary narration-btn" onclick={toggleNarration} disabled={busy}>
                            {playing ? "⏸ Pause" : "▶ Play narration"}
                        </button>
                    {:else if audioError}
                        <span class="narration-status error">{audioError}</span>
                    {:else if gameState?.storyAudioReady === false}
                        <span class="narration-status muted">Narration unavailable this round — read it yourself.</span>
                    {/if}
                </div>
                {#if story.title}<h2 class="story-title">{story.title}</h2>{/if}
                <div class="story-body">
                    {#each story.paragraphs as para}
                        <p>{@html para}</p>
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
            <section class="centered">
                {#if gameState?.mvp}
                    <div class="trophy">🏆</div>
                    <h2 class="display sm">Round MVP: {gameState.mvp.name}</h2>
                    <p class="mvp-quote">“{gameState.mvp.value}”</p>
                    <p class="muted">for <em>{gameState.mvp.prompt}</em> · {gameState.mvp.votes} vote{gameState.mvp.votes === 1 ? "" : "s"}</p>
                {:else}
                    <h2 class="display sm">No votes cast this round.</h2>
                {/if}

                {#if leaderboard.length > 0}
                    <ol class="leaderboard">
                        {#each leaderboard as row}
                            <li><span>{row.name}</span><span class="lb-pts">{row.points}</span></li>
                        {/each}
                    </ol>
                {/if}

                <div class="reveal-actions">
                    <button class="ghost" onclick={() => act("finish")} disabled={busy}>End game</button>
                    <button class="primary" onclick={startRound} disabled={busy || players.length === 0}>Next round →</button>
                </div>
            </section>

        {:else if phase === "finished"}
            <section class="centered">
                <div class="trophy">👑</div>
                <h2 class="display">That's a wrap.</h2>
                {#if leaderboard.length > 0}
                    <p class="lede">Overall leader: <strong>{leaderboard[0].name}</strong></p>
                    <ol class="leaderboard">
                        {#each leaderboard as row}
                            <li><span>{row.name}</span><span class="lb-pts">{row.points}</span></li>
                        {/each}
                    </ol>
                {/if}
                <button class="primary big" onclick={() => act("reset")} disabled={busy}>New game</button>
            </section>
        {/if}
    {/if}

    {#if netError}<div class="net-note">{netError}</div>{/if}
</div>

<style>
    .host {
        max-width: 1100px;
        margin: 0 auto;
        padding: 2rem 1.5rem 4rem;
        min-height: 100vh;
    }

    .display {
        font-family: 'Fraunces', serif;
        font-weight: 700;
        letter-spacing: -0.03em;
        color: var(--header-colour);
        font-size: clamp(2.2rem, 6vw, 4.5rem);
        line-height: 1.02;
        margin: 0 0 0.6rem;
    }
    .display.sm { font-size: clamp(1.8rem, 4.5vw, 3rem); }
    .lede {
        font-size: clamp(1rem, 2vw, 1.35rem);
        opacity: 0.85;
        max-width: 50ch;
        margin: 0 auto 1.5rem;
    }

    /* --- Setup --- */
    .setup { max-width: 640px; margin: 6vh auto 0; text-align: center; }
    .setup .lede { margin-left: auto; margin-right: auto; }
    .field-label {
        display: block;
        text-align: left;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--main-green);
        margin-bottom: 0.4rem;
    }
    textarea {
        width: 100%;
        box-sizing: border-box;
        font: inherit;
        color: var(--header-colour);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--main-green-translucent);
        border-radius: 12px;
        padding: 0.85rem 1rem;
        outline: none;
        resize: vertical;
        margin-bottom: 1rem;
    }
    textarea:focus { border-color: var(--main-green); }

    .pack-upload {
        text-align: left;
        margin-bottom: 1.25rem;
        padding: 1rem 1.1rem;
        border-radius: 12px;
        border: 1px dashed var(--main-green-translucent);
        background: rgba(255, 255, 255, 0.03);
    }
    .pack-upload.compact {
        margin-bottom: 1rem;
        padding: 0.75rem 1rem;
    }
    .pack-hint { font-size: 0.9rem; margin: 0 0 0.65rem; opacity: 0.9; }
    .pack-hint code { font-size: 0.85em; }
    .pack-ok { color: var(--main-green); font-size: 0.9rem; margin: 0.35rem 0 0; }
    .pack-upload input[type="file"] {
        font: inherit;
        color: var(--paragraph-colour);
        max-width: 100%;
    }
    .pack-replace {
        cursor: pointer;
        text-decoration: underline;
        color: var(--main-green);
    }
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
    }

    /* --- Top bar --- */
    .bar {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        padding-bottom: 1.25rem;
        margin-bottom: 1.5rem;
        border-bottom: 1px solid var(--main-green-translucent);
    }
    .bar-code-label {
        display: block;
        font-size: 0.62rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--main-green);
        opacity: 0.8;
    }
    .bar-code-value {
        font-family: 'Fraunces', serif;
        font-weight: 700;
        font-size: 1.6rem;
        letter-spacing: 0.1em;
        color: var(--header-colour);
    }
    .bar-leader { margin-left: auto; text-align: right; }
    .bar-leader-name { font-weight: 600; color: var(--header-colour); }

    /* --- Lobby --- */
    .lobby {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
        gap: 2.5rem;
        align-items: start;
    }
    .lobby-join { text-align: center; }
    .section-title {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-size: 1.4rem;
        color: var(--header-colour);
        margin: 0 0 1rem;
    }
    .join-hint { opacity: 0.8; font-size: 0.95rem; margin: 1rem 0 0.5rem; }
    .bigcode {
        font-family: 'Fraunces', serif;
        font-weight: 700;
        font-size: clamp(3rem, 9vw, 5.5rem);
        letter-spacing: 0.18em;
        color: var(--main-green);
        margin-top: 0.5rem;
    }
    .bigcode.inline {
        font-size: clamp(2rem, 6vw, 3.2rem);
        margin-top: 0;
        letter-spacing: 0.14em;
    }
    .join-manual {
        margin-top: 1.25rem;
        padding: 1rem 1.25rem;
        border-radius: 12px;
        background: var(--item-background);
        border: var(--item-border);
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
    }
    .join-manual-row {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .join-manual-label {
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--main-green);
        opacity: 0.85;
    }
    .join-pw {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-size: 1.35rem;
        color: var(--header-colour);
        word-break: break-all;
    }
    .player-list {
        list-style: none;
        padding: 0; margin: 0 0 1.5rem;
        display: flex; flex-wrap: wrap; gap: 0.5rem;
    }
    .player-list li {
        background: var(--item-background);
        border: var(--item-border);
        border-radius: 999px;
        padding: 0.35rem 0.9rem;
        font-size: 0.95rem;
        color: var(--header-colour);
    }
    .round-setup {
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--main-green-translucent);
    }
    .mini-title {
        font-size: 0.72rem; font-weight: 600; letter-spacing: 0.12em;
        text-transform: uppercase; color: var(--main-green); margin: 0 0 0.6rem;
    }
    .pool-buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .pool-btn {
        font: inherit; cursor: pointer;
        background: var(--item-background);
        border: 1px solid var(--main-green-translucent);
        color: var(--paragraph-colour);
        border-radius: 999px;
        padding: 0.45rem 1rem;
        transition: all 0.15s ease;
    }
    .pool-btn.on {
        background: var(--main-green);
        color: var(--background-one);
        border-color: var(--main-green);
        font-weight: 600;
    }
    .slots-row {
        display: flex; align-items: center; gap: 0.75rem;
        font-size: 0.9rem; margin-bottom: 1.2rem; color: var(--paragraph-colour);
    }
    .slots-row input {
        width: 4rem; font: inherit; text-align: center;
        color: var(--header-colour);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--main-green-translucent);
        border-radius: 8px; padding: 0.4rem;
    }

    /* --- Centered phases --- */
    .centered { text-align: center; max-width: 760px; margin: 4vh auto 0; }
    .progress-big {
        font-family: 'Fraunces', serif; font-weight: 700;
        font-size: clamp(2rem, 6vw, 3.5rem); color: var(--main-green);
        margin: 0.5rem 0 1.5rem;
    }
    .chip-list { list-style: none; padding: 0; margin: 0 0 2rem; display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
    .chip {
        background: var(--item-background);
        border: var(--item-border);
        border-radius: 999px; padding: 0.35rem 0.9rem; font-size: 0.95rem;
        color: var(--paragraph-colour); opacity: 0.6;
    }
    .chip.done { opacity: 1; border-color: var(--main-green); color: var(--header-colour); }

    .ballot-preview { list-style: none; padding: 0; margin: 1.5rem auto; max-width: 600px; text-align: left; }
    .ballot-preview li {
        padding: 0.6rem 0.9rem; margin-bottom: 0.5rem;
        background: var(--item-background); border: var(--item-border);
        border-radius: 10px; color: var(--header-colour);
    }
    .ballot-prompt { display: block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--main-green); opacity: 0.85; }

    /* --- Reveal / story --- */
    .reveal { max-width: 820px; margin: 2vh auto 0; }
    .narration-bar {
        display: flex;
        justify-content: center;
        margin-bottom: 1.25rem;
    }
    .narration-btn { font-size: 1.05rem; padding: 0.65rem 1.4rem; }
    .narration-status { font-size: 0.95rem; }
    .reveal-wait { padding: 3rem 0; }
    .story-title {
        font-family: 'Fraunces', serif; font-weight: 700;
        font-size: clamp(2rem, 5vw, 3.2rem); color: var(--header-colour);
        letter-spacing: -0.02em; margin: 0 0 1.5rem; text-align: center;
    }
    .story-body {
        font-size: clamp(1.15rem, 2.2vw, 1.6rem);
        line-height: 1.6; color: var(--paragraph-colour);
    }
    .story-body :global(strong) {
        color: var(--main-green); font-weight: 700;
        background: var(--intro-highlight-colour);
        padding: 0 0.15em; border-radius: 4px;
    }
    .story-body p { margin: 0 0 1.1rem; }

    .reveal-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 2rem; flex-wrap: wrap; }

    /* --- Results --- */
    .trophy { font-size: clamp(3rem, 10vw, 6rem); line-height: 1; }
    .mvp-quote {
        font-family: 'Fraunces', serif; font-style: italic;
        font-size: clamp(1.4rem, 4vw, 2.4rem); color: var(--header-colour); margin: 0.5rem 0;
    }
    .leaderboard { list-style: none; counter-reset: rank; padding: 0; margin: 2rem auto; max-width: 420px; }
    .leaderboard li {
        counter-increment: rank;
        display: flex; justify-content: space-between; align-items: center;
        padding: 0.6rem 1rem; margin-bottom: 0.4rem;
        background: var(--item-background); border: var(--item-border); border-radius: 10px;
        color: var(--header-colour);
    }
    .leaderboard li::before { content: counter(rank) "."; color: var(--main-green); font-weight: 700; margin-right: 0.6rem; }
    .lb-pts { font-weight: 700; color: var(--main-green); }

    /* --- Buttons --- */
    .primary, .ghost {
        font: inherit; font-weight: 600; cursor: pointer;
        border-radius: 10px; padding: 0.7rem 1.4rem;
        transition: opacity 0.15s ease, transform 0.1s ease;
    }
    .primary { background: var(--main-green); color: var(--background-one); border: none; }
    .primary.big { font-size: 1.1rem; padding: 0.9rem 2rem; }
    .primary:hover:not(:disabled) { opacity: 0.92; }
    .primary:active:not(:disabled) { transform: scale(0.98); }
    .ghost { background: transparent; color: var(--main-green); border: 1px solid var(--main-green-translucent); }
    .ghost:hover:not(:disabled) { border-color: var(--main-green); }
    .ghost.small, .primary.small { padding: 0.4rem 0.9rem; font-size: 0.85rem; }
    .primary:disabled, .ghost:disabled { opacity: 0.45; cursor: not-allowed; }

    .hint { font-size: 0.85rem; opacity: 0.6; margin-top: 0.75rem; }
    .muted { opacity: 0.75; }
    .error { color: #d97777; margin: 0.5rem 0; }

    .spinner {
        width: 54px; height: 54px; margin: 0 auto 1.5rem;
        border: 4px solid var(--main-green-translucent);
        border-top-color: var(--main-green);
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .net-note {
        position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%);
        font-size: 0.8rem; opacity: 0.6;
    }

    @media (max-width: 760px) {
        .lobby { grid-template-columns: 1fr; }
    }
</style>
