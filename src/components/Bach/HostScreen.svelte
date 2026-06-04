<!--
    Host (big-screen) controller. Owns setup, lobby + round config, and party-pack
    handling, then routes each game phase to a focused host/* component. The
    reveal + voting phases share a NarrationPlayer (kept mounted across them so
    audio is continuous). All mutations go through callbacks from Bach.svelte.
-->
<script>
    import "./lib/bach.css";
    import {
        drawPrompts,
        loadUsedPrompts,
        saveUsedPrompts,
        clearUsedPrompts,
        defaultPoolForRound,
    } from "./lib/partyConfig.js";
    import { validatePartyPack } from "./lib/validatePartyPack.js";
    import HostBar from "./host/HostBar.svelte";
    import SetupScreen from "./host/SetupScreen.svelte";
    import LobbyScreen from "./host/LobbyScreen.svelte";
    import WritingScreen from "./host/WritingScreen.svelte";
    import GeneratingScreen from "./host/GeneratingScreen.svelte";
    import NarrationPlayer from "./host/NarrationPlayer.svelte";
    import RevealScreen from "./host/RevealScreen.svelte";
    import VotingScreen from "./host/VotingScreen.svelte";
    import ResultsScreen from "./host/ResultsScreen.svelte";
    import FinishedScreen from "./host/FinishedScreen.svelte";

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
        onExit,
        onJoinRoom,
    } = $props();

    const allPools = $derived(party.pools);
    const defaultSlots = $derived(party.slotsPerPlayer);

    const pools = $derived(allPools);

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
    let peopleText = $state("");
    let creating = $state(false);

    $effect(() => {
        if (code || !party) return;
        if (party.defaultFacts && !facts) facts = party.defaultFacts;
        if (party.storyTone && !storyTone) storyTone = party.storyTone;
        if (party.people && !peopleText) peopleText = serializePeople(party.people);
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
        selectedPool = defaultPoolForRound(party, allPools);
    });

    $effect(() => {
        if (!pools.length) return;
        slots = defaultSlots;
        const pick = defaultPoolForRound(party, pools);
        if (!selectedPool || !pools.some((p) => p.id === selectedPool)) {
            selectedPool = pick;
        }
    });

    let busy = $state(false);

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

    // The people map is shown/edited as one "Name: look" line per person.
    function serializePeople(obj) {
        return Object.entries(obj || {}).map(([name, look]) => `${name}: ${look}`).join("\n");
    }
    function parsePeople(text) {
        const out = {};
        for (const line of (text || "").split("\n")) {
            const idx = line.indexOf(":");
            if (idx < 1) continue;
            const name = line.slice(0, idx).trim();
            const look = line.slice(idx + 1).trim();
            if (name && look) out[name] = look;
        }
        return out;
    }

    async function create() {
        creating = true;
        try { await onCreate(facts, storyTone, parsePeople(peopleText)); } finally { creating = false; }
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
        try { await onGenerate(); } finally { busy = false; }
    }

    // Leaving the big screen abandons host control of the room — confirm first.
    function confirmExit() {
        if (typeof window !== "undefined" && !window.confirm("Leave this room? You'll lose host control of it.")) return;
        onExit?.();
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
            bind:peopleText
            {onPackSelect}
            {onPackReload}
            {onPackFileSelect}
            {onJoinRoom}
            onCreate={create}
        />
    {:else}
        <HostBar {code} {leaderboard} {busy} onReset={() => act("reset")} onExit={confirmExit} />

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
                {pools}
                {busy}
                bind:selectedPool
                bind:slots
                {onPackSelect}
                {onPackReload}
                {onPackFileSelect}
                onStartRound={startRound}
            />

        {:else if phase === "writing"}
            <WritingScreen {players} {counts} error={gameState?.error} {busy} onGenerate={generate} />

        {:else if phase === "generating"}
            <GeneratingScreen {busy} onAbort={() => act("abortGenerating")} />

        {:else if phase === "reveal" || phase === "voting"}
            <NarrationPlayer {code} {password} {gameState} {busy} compact={phase === "voting"} {onRequestTts} />
            {#if phase === "reveal"}
                <RevealScreen
                    {code}
                    {password}
                    {gameState}
                    {busy}
                    onGenerate={generate}
                    onOpenVoting={() => act("openVoting")}
                    {onRequestImages}
                />
            {:else}
                <VotingScreen {gameState} {players} {busy} onTally={() => act("tally")} />
            {/if}

        {:else if phase === "results"}
            <ResultsScreen mvp={gameState?.mvp} {leaderboard} {players} {busy} onFinish={() => act("finish")} onNextRound={startRound} />

        {:else if phase === "finished"}
            <FinishedScreen {leaderboard} {busy} onReset={() => act("reset")} />
        {/if}
    {/if}

    {#if netError}<div class="net-note">{netError}</div>{/if}
</div>
