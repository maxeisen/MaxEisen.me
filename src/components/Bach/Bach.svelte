<!--
    Controller for the collaborative story game at /bach.

    Owns: the password gate, the host-vs-player split (driven by the URL's
    ?room= param), persistent identity in localStorage, and the single polling
    loop against bach/state. Child screens are pure-ish views that call the
    action callbacks passed down here.
-->
<script>
    import { onMount } from "svelte";
    import * as api from "./api.js";
    import { getParty, setPrivatePartyPack, clearPrivatePartyPack } from "./partyConfig.js";
    import { validatePartyPack } from "./validatePartyPack.js";
    import HostScreen from "./HostScreen.svelte";
    import PlayerScreen from "./PlayerScreen.svelte";

    const POLL_MS = 1500;

    let password = $state(null);
    let pwInput = $state("");
    let pwError = $state("");
    let pwChecking = $state(false);
    let pwInputRef;

    let mode = $state("loading"); // "host" | "player"
    let code = $state(null);
    let hostToken = $state(null);
    let player = $state(null); // { playerId, name }

    let gameState = $state(null);
    let sessionMissing = $state(false);
    let netError = $state("");
    let party = $state(getParty());
    let partyLoading = $state(false);
    let partyCatalog = $state({ packs: [], activePackId: null, source: null });

    let pollTimer = null;
    let pollingFor = null; // code we currently poll, to avoid dup intervals
    let pollAbort = null;  // AbortController for the in-flight state fetch

    // Parse URL once. ?room=CODE => player join flow; ?k=PASSWORD => QR key.
    const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
    const roomParam = (url?.searchParams.get("room") || "").toUpperCase();
    const keyParam = url?.searchParams.get("k") || "";

    onMount(() => {
        try {
            const stored = localStorage.getItem("bach:pw");
            if (stored) password = stored;
        } catch {}
        if (!password && keyParam) password = keyParam;

        if (roomParam) {
            mode = "player";
            code = roomParam;
            try {
                const p = localStorage.getItem(`bach:player:${code}`);
                if (p) player = JSON.parse(p);
            } catch {}
        } else {
            mode = "host";
            try {
                const c = localStorage.getItem("bach:hostCode");
                if (c) {
                    const t = localStorage.getItem(`bach:host:${c}`);
                    if (t) { code = c; hostToken = t; }
                }
            } catch {}
        }

        if (password) {
            // Validate silently; if it's wrong, fall back to the gate.
            validatePassword(password, true);
        } else {
            requestAnimationFrame(() => pwInputRef?.focus());
        }

        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", onVisibilityChange);
        }
        return () => {
            stopPoll();
            if (typeof document !== "undefined") {
                document.removeEventListener("visibilitychange", onVisibilityChange);
            }
        };
    });

    // Keep a single poll loop alive whenever we have a password + a code.
    $effect(() => {
        if (password && code) startPoll(code);
        else stopPoll();
    });

    function startPoll(forCode) {
        if (pollingFor === forCode && pollTimer) return;
        stopPoll();
        pollingFor = forCode;
        schedulePoll();
    }
    function schedulePoll() {
        // Don't poll while the tab is backgrounded — resume on visibilitychange.
        if (!pollingFor || pollTimer) return;
        if (typeof document !== "undefined" && document.hidden) return;
        poll();
        pollTimer = setInterval(poll, POLL_MS);
    }
    function stopPoll() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
        pollingFor = null;
    }
    function onVisibilityChange() {
        if (typeof document === "undefined") return;
        if (document.hidden) {
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        } else {
            schedulePoll();
        }
    }

    async function poll() {
        if (!password || !code) return;
        // Abort any in-flight poll so a slow earlier response can't overwrite a
        // newer one (and requests don't pile up on a weak connection).
        pollAbort?.abort();
        const ctrl = new AbortController();
        pollAbort = ctrl;
        try {
            const { ok, status, data } = await api.fetchState(password, code, player?.playerId, ctrl.signal);
            if (ctrl.signal.aborted) return;
            if (status === 401) {
                password = null;
                try { localStorage.removeItem("bach:pw"); } catch {}
                stopPoll();
                pwError = "Password no longer valid.";
                return;
            }
            if (status === 404) {
                gameState = null;
                sessionMissing = true;
                if (mode === "host") {
                    // Stale host session — drop back to the create screen.
                    try { localStorage.removeItem("bach:hostCode"); } catch {}
                    code = null;
                    hostToken = null;
                }
                return;
            }
            if (ok) {
                gameState = data;
                sessionMissing = false;
                netError = "";
            }
        } catch (err) {
            if (err?.name === "AbortError") return;
            netError = "Reconnecting…";
        } finally {
            if (pollAbort === ctrl) pollAbort = null;
        }
    }

    async function loadPartyPack(pw) {
        partyLoading = true;
        try {
            let { ok, data } = await api.fetchPartyPack(pw, null, { library: true });
            const packId = data?.activePackId || data?.packs?.[0]?.id;
            if (packId) {
                const fresh = await api.fetchPartyPack(pw, packId, { library: true });
                if (fresh.ok && fresh.data?.party) {
                    ok = fresh.ok;
                    data = { ...data, ...fresh.data };
                }
            }
            partyCatalog = {
                packs: data?.packs ?? [],
                activePackId: data?.activePackId ?? packId ?? null,
                source: data?.source ?? null,
            };
            if (ok && data?.party) {
                setPrivatePartyPack(data.party);
            } else {
                clearPrivatePartyPack();
            }
        } catch {
            partyCatalog = { packs: [], activePackId: null, source: null };
            clearPrivatePartyPack();
        } finally {
            party = getParty();
            partyLoading = false;
        }
    }

    async function selectPartyPack(packId) {
        const { ok, status, data } = await api.selectPartyPack(password, packId);
        if (!ok) {
            const msg = data?.error === "pack_not_found"
                ? "That party pack isn't on the server yet."
                : data?.error || `Could not switch pack (${status})`;
            throw new Error(msg);
        }
        if (data?.party) setPrivatePartyPack(data.party);
        partyCatalog = {
            packs: partyCatalog.packs,
            activePackId: packId,
            source: "library",
        };
        party = getParty();
        return data.party;
    }

    /** Clear custom override and pull the selected library pack from Blobs again. */
    async function reloadPartyPack(packId) {
        const id = (packId || partyCatalog.activePackId || partyCatalog.packs[0]?.id || "").trim();
        if (!id) throw new Error("Pick a party pack first.");

        clearPrivatePartyPack();
        party = getParty();

        const loaded = await selectPartyPack(id);

        const { ok, data } = await api.fetchPartyPack(password, id, { library: true });
        if (ok && data?.packs) {
            partyCatalog = {
                packs: data.packs,
                activePackId: id,
                source: "library",
            };
        }
        if (ok && data?.party) {
            setPrivatePartyPack(data.party);
            party = getParty();
        }

        return loaded ?? data?.party;
    }

    /** Host uploads a party JSON file → Blobs custom override. */
    async function applyPartyPack(raw) {
        const problem = validatePartyPack(raw);
        if (problem) throw new Error(problem);
        const { ok, status, data } = await api.uploadPartyPack(password, raw);
        if (!ok) {
            const msg = data?.error === "too_large"
                ? "Party pack file is too large for the server."
                : data?.error || `Upload failed (${status})`;
            throw new Error(msg);
        }
        if (data?.party) setPrivatePartyPack(data.party);
        else setPrivatePartyPack(raw);
        partyCatalog = { ...partyCatalog, source: "custom" };
        party = getParty();
    }

    async function validatePassword(pw, silent = false) {
        pwChecking = true;
        if (!silent) pwError = "";
        try {
            const trimmed = pw.trim();
            const { ok, status } = await api.checkPassword(trimmed);
            if (ok) {
                password = trimmed;
                try { localStorage.setItem("bach:pw", trimmed); } catch {}
                await loadPartyPack(trimmed);
            } else {
                password = null;
                try { localStorage.removeItem("bach:pw"); } catch {}
                if (!silent) {
                    pwError = status === 503
                        ? "This game isn't set up on the server yet — check with the host."
                        : "Wrong password.";
                }
            }
        } catch {
            if (!silent) pwError = "Network error. Try again.";
        } finally {
            pwChecking = false;
        }
    }

    function submitPassword(e) {
        e.preventDefault();
        if (pwChecking || !pwInput) return;
        validatePassword(pwInput.trim(), false);
    }

    // --- Host actions ------------------------------------------------------
    async function createSession(facts, storyTone = "") {
        const { ok, data } = await api.createSession(password, {
            facts,
            partyId: party.id,
            groom: party.groom,
            partner: party.partner,
            storyTone: storyTone.trim(),
        });
        if (ok && data?.code) {
            code = data.code;
            hostToken = data.hostToken;
            try {
                localStorage.setItem("bach:hostCode", code);
                localStorage.setItem(`bach:host:${code}`, hostToken);
            } catch {}
            await poll();
        }
        return ok;
    }

    async function doHostAction(action, extra = {}) {
        const { ok } = await api.hostAction(password, { code, hostToken, action, ...extra });
        await poll();
        return ok;
    }

    async function generate() {
        const { ok } = await api.generateStory(password, { code, hostToken });
        await poll();
        if (!ok) {
            await doHostAction("abortGenerating");
            await poll();
            return false;
        }
        void requestStoryTts();
        void requestStoryImages();
        return true;
    }

    let ttsBusy = false;
    let imagesBusy = false;

    /** Record narration (story text must already exist). */
    async function requestStoryTts() {
        if (ttsBusy || !code || !hostToken) return false;
        ttsBusy = true;
        try {
            for (let attempt = 0; attempt < 6; attempt++) {
                const { ok, status, accepted } = await api.generateStoryTts(password, { code, hostToken });
                if (ok || accepted) {
                    await poll();
                    return true;
                }
                if (status === 409 && attempt < 5) {
                    await new Promise((r) => setTimeout(r, 400));
                    await poll();
                    continue;
                }
                await poll();
                return false;
            }
            return false;
        } finally {
            ttsBusy = false;
        }
    }

    async function requestStoryImages(force = false) {
        if (imagesBusy || !code || !hostToken) return false;
        imagesBusy = true;
        try {
            for (let attempt = 0; attempt < 6; attempt++) {
                const { ok, status, accepted } = await api.generateStoryImages(password, {
                    code,
                    hostToken,
                    force,
                });
                if (ok || accepted) {
                    await poll();
                    return true;
                }
                if (status === 409 && attempt < 5) {
                    await new Promise((r) => setTimeout(r, 400));
                    await poll();
                    continue;
                }
                await poll();
                return false;
            }
            return false;
        } finally {
            imagesBusy = false;
        }
    }

    // --- Player actions ----------------------------------------------------
    async function joinGame(name) {
        const { ok, data } = await api.joinSession(password, {
            code,
            name,
            playerId: player?.playerId,
        });
        if (ok && data?.playerId) {
            player = { playerId: data.playerId, name: data.name };
            try { localStorage.setItem(`bach:player:${code}`, JSON.stringify(player)); } catch {}
            await poll();
        }
        return ok;
    }

    async function submitWord(slotId, value, skipPoll = false) {
        const { ok } = await api.submitWord(password, { code, playerId: player?.playerId, slotId, value });
        if (!skipPoll) await poll();
        return ok;
    }

    async function swapPrompt(slotId) {
        const { ok, data } = await api.swapPrompt(password, {
            code,
            playerId: player?.playerId,
            slotId,
        });
        await poll();
        return { ok, data };
    }

    async function vote(targetSubId) {
        const { ok } = await api.castVote(password, { code, playerId: player?.playerId, targetSubId });
        await poll();
        return ok;
    }
</script>

<div class="bach-root">
    {#if !password}
        <div class="bach-gate" role="dialog" aria-modal="true">
            <form class="bach-gate-form" onsubmit={submitPassword}>
                <h1 class="bach-gate-title">Story Builder</h1>
                <p class="bach-gate-sub">Invite only. Enter the password from the group chat.</p>
                <label for="bach-pw">Password</label>
                <input
                    bind:this={pwInputRef}
                    bind:value={pwInput}
                    id="bach-pw"
                    type="password"
                    autocomplete="off"
                    required
                    disabled={pwChecking}
                />
                <button type="submit" disabled={pwChecking || !pwInput}>
                    {pwChecking ? "Checking…" : "Enter"}
                </button>
                {#if pwError}<div class="bach-gate-error">{pwError}</div>{/if}
            </form>
        </div>
    {:else if partyLoading}
        <div class="bach-loading">
            <div class="bach-spinner" aria-hidden="true"></div>
            <p>Loading party…</p>
        </div>
    {:else if mode === "player"}
        <PlayerScreen
            {code}
            {player}
            gameTitle={party.title}
            {gameState}
            {sessionMissing}
            {netError}
            onJoin={joinGame}
            onSubmitWord={submitWord}
            onSwapPrompt={swapPrompt}
            onVote={vote}
        />
    {:else}
        <HostScreen
            {party}
            {partyCatalog}
            {code}
            {password}
            {gameState}
            {netError}
            onCreate={createSession}
            onSelectPartyPack={selectPartyPack}
            onReloadPartyPack={reloadPartyPack}
            onPartyPackUpload={applyPartyPack}
            onRequestTts={requestStoryTts}
            onRequestImages={requestStoryImages}
            onAction={doHostAction}
            onGenerate={generate}
        />
    {/if}
</div>

<style>
    .bach-root {
        min-height: 100vh;
        background: var(--background-one);
        color: var(--paragraph-colour);
        font-family: 'Inter', sans-serif;
    }

    .bach-loading {
        min-height: 60vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        opacity: 0.85;
    }
    .bach-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--main-green-translucent);
        border-top-color: var(--main-green);
        border-radius: 50%;
        animation: bach-spin 0.8s linear infinite;
    }
    @keyframes bach-spin { to { transform: rotate(360deg); } }

    .bach-gate {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(28, 26, 23, 0.92);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        padding: 1rem;
    }
    .bach-gate-form {
        min-width: min(380px, 92vw);
        padding: 1.75rem 2rem;
        border-radius: 16px;
        background: var(--background-one);
        border: 1px solid var(--main-green-translucent);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
    }
    .bach-gate-title {
        font-family: 'Fraunces', serif;
        font-weight: 700;
        font-size: 1.8rem;
        letter-spacing: -0.02em;
        color: var(--header-colour);
        margin: 0;
    }
    .bach-gate-sub {
        font-size: 0.9rem;
        color: var(--paragraph-colour);
        opacity: 0.8;
        margin: 0;
    }
    label {
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--main-green);
    }
    input {
        font: inherit;
        color: var(--header-colour);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--main-green-translucent);
        border-radius: 8px;
        padding: 0.6rem 0.75rem;
        outline: none;
        transition: border-color 0.15s ease, background 0.15s ease;
    }
    input:focus {
        border-color: var(--main-green);
        background: rgba(255, 255, 255, 0.06);
    }
    button {
        font: inherit;
        font-weight: 600;
        color: var(--background-one);
        background: var(--main-green);
        border: none;
        border-radius: 8px;
        padding: 0.65rem 1rem;
        cursor: pointer;
        transition: opacity 0.15s ease, transform 0.1s ease;
    }
    button:hover:not(:disabled) { opacity: 0.92; }
    button:active:not(:disabled) { transform: scale(0.97); }
    button:disabled { opacity: 0.5; cursor: progress; }
    .bach-gate-error {
        font-size: 0.82rem;
        color: #d97777;
    }
</style>
