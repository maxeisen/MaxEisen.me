<!-- Lobby: QR + join details, the players list, party-pack picker, and round setup. -->
<script>
    import Qr from "../Qr.svelte";

    let {
        party,
        partyCatalog = { packs: [], activePackId: null, source: null },
        packOptions = [],
        code,
        password,
        players = [],
        joinUrl = "",
        joinPathManual = "",
        packSelecting = false,
        packUploading = false,
        packError = "",
        packStatus = "",
        pools = [],
        busy = false,
        selectedPool = $bindable(""),
        slots = $bindable(3),
        onPackSelect,
        onPackReload,
        onPackFileSelect,
        onStartRound,
    } = $props();
</script>

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
            {#if packOptions.length > 0}
                <div class="pack-select-row">
                    <select
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
                    >
                        Reload
                    </button>
                </div>
            {:else}
                <p class="pack-hint"><strong>{party.title}</strong></p>
            {/if}
            <details class="pack-advanced compact">
                <summary>Custom JSON</summary>
                <input
                    id="party-pack-file-lobby"
                    type="file"
                    accept="application/json,.json"
                    disabled={packUploading || packSelecting}
                    onchange={onPackFileSelect}
                />
            </details>
            {#if packStatus}<p class="pack-ok">{packStatus}</p>{/if}
            {#if packError}<p class="error">{packError}</p>{/if}
        </div>

        <div class="round-setup">
            <h3 class="mini-title">Round flavour</h3>
            {#if pools.length === 0}
                <p class="error">No prompt pools — check the party pack JSON.</p>
            {/if}
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
            <button class="primary big" onclick={onStartRound} disabled={busy || players.length === 0}>
                {busy ? "Dealing prompts…" : "Start the round"}
            </button>
            {#if players.length === 0}<p class="hint">Need at least one player.</p>{/if}
        </div>
    </div>
</section>
