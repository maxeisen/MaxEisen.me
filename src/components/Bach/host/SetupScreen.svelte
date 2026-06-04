<!-- Pre-session setup: pick a party pack, set story context + tone, create the session. -->
<script>
    let {
        party,
        packOptions = [],
        partyCatalog = { packs: [], activePackId: null, source: null },
        packSelecting = false,
        packUploading = false,
        packError = "",
        packStatus = "",
        creating = false,
        facts = $bindable(""),
        storyTone = $bindable(""),
        peopleText = $bindable(""),
        onPackSelect,
        onPackReload,
        onPackFileSelect,
        onJoinRoom,
        onCreate,
    } = $props();

    let joinCode = $state("");
    let joinError = $state("");
    function submitJoin() {
        if (onJoinRoom?.(joinCode) === false) joinError = "Enter a valid 4-character room code.";
    }
</script>

<section class="setup">
    <h1 class="display">{party.title}</h1>

    <div class="join-existing">
        <span class="join-existing-label">Joining a friend's game?</span>
        <div class="join-existing-row">
            <input
                bind:value={joinCode}
                placeholder="Room code"
                maxlength="4"
                autocapitalize="characters"
                autocomplete="off"
                oninput={() => (joinError = "")}
                onkeydown={(e) => { if (e.key === "Enter") submitJoin(); }}
            />
            <button type="button" class="primary" onclick={submitJoin}>Join</button>
        </div>
        {#if joinError}<p class="error">{joinError}</p>{/if}
    </div>

    <p class="lede">Or start a new game on this screen — guests fill in prompts on their phones; AI weaves their answers into one story. Pick a party pack, then add context and tone below.</p>

    <div class="pack-upload">
        <label class="field-label" for="party-pack-select">Party pack</label>
        {#if packOptions.length > 0}
            <div class="pack-select-row">
                <select
                    id="party-pack-select"
                    class="pack-select"
                    value={partyCatalog.activePackId || packOptions[0]?.id || ""}
                    disabled={packSelecting || packUploading}
                    onchange={onPackSelect}
                >
                    {#each packOptions as entry (entry.id)}
                        <option value={entry.id}>{entry.title}</option>
                    {/each}
                </select>
                <button
                    type="button"
                    class="ghost pack-reload-btn"
                    disabled={packSelecting || packUploading}
                    onclick={onPackReload}
                    title="Fetch latest pack from private GitHub"
                >
                    Reload
                </button>
            </div>
            <p class="pack-hint muted">
                {#if partyCatalog.source === "github"}
                    Loaded from private GitHub.
                {:else if partyCatalog.source === "custom"}
                    Custom JSON override — Reload to pull from GitHub again.
                {:else}
                    Loads latest from private GitHub when you open or reload.
                {/if}
            </p>
        {:else}
            <p class="pack-hint">
                No packs configured — set <code>PRIVATE_ACCESS_GITHUB_TOKEN</code> on Netlify Functions, or use <code>BACH_PARTY_JSON_PATH</code> locally.
            </p>
        {/if}
        <details class="pack-advanced">
            <summary>Upload custom JSON (override)</summary>
            <input
                id="party-pack-file"
                type="file"
                accept="application/json,.json"
                disabled={packUploading || packSelecting}
                onchange={onPackFileSelect}
            />
        </details>
        {#if packUploading || packSelecting}<p class="muted">Updating pack…</p>{/if}
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
    <label class="field-label" for="people">People (look references for the illustrations)</label>
    <textarea
        id="people"
        bind:value={peopleText}
        rows="8"
        placeholder="One per line — Name: short look description.&#10;Matthew: the groom; lean, sharp designer streetwear"
    ></textarea>
    <button class="primary big" onclick={onCreate} disabled={creating}>
        {creating ? "Starting…" : "Start a session"}
    </button>
    <p class="hint">You can update context later from the lobby if needed.</p>
</section>
