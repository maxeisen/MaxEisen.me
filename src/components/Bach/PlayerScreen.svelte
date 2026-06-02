<!--
    Player (phone) view. Name entry, then the per-round word prompts, the
    MVP vote ballot, and lightweight "watch the big screen" states.
-->
<script>
    let { code, player, gameTitle = "Story Builder", gameState, sessionMissing, netError, onJoin, onSubmitWord, onSwapPrompt, onVote } = $props();

    let nameInput = $state("");
    let joining = $state(false);
    let drafts = $state({});
    let draftsEpoch = $state(null);
    let savingSlot = $state(null);
    let swappingSlot = $state(null);
    let swapError = $state("");
    let voting = $state(false);

    const phase = $derived(gameState?.phase ?? null);
    const roundIndex = $derived(gameState?.roundIndex ?? null);
    const you = $derived(gameState?.you ?? null);
    const slots = $derived(you?.slots ?? []);
    // roundIndex alone isn't enough (a reset game starts at 0 again) — pair
    // with host version which bumps on every phase change.
    const writingEpoch = $derived(
        phase === "writing" && roundIndex != null
            ? `${roundIndex}:${gameState?.version ?? 0}`
            : null,
    );

    // Slot ids (s0, s1, …) are reused every round — reset drafts when the
    // writing epoch changes, then only backfill undefined keys within it.
    $effect(() => {
        const epoch = writingEpoch;
        const list = slots;
        if (epoch == null || list.length === 0) return;

        if (epoch !== draftsEpoch) {
            draftsEpoch = epoch;
            swapError = "";
            const next = {};
            for (const s of list) next[s.slotId] = s.value || "";
            drafts = next;
            return;
        }

        let changed = false;
        const next = { ...drafts };
        for (const s of list) {
            if (next[s.slotId] === undefined) {
                next[s.slotId] = s.value || "";
                changed = true;
            }
        }
        if (changed) drafts = next;
    });

    function isSaved(slot) {
        return slot.value && slot.value.trim() === (drafts[slot.slotId] ?? "").trim();
    }
    const allSaved = $derived(slots.length > 0 && slots.every((s) => s.value));

    async function join(e) {
        e.preventDefault();
        if (joining || !nameInput.trim()) return;
        joining = true;
        try { await onJoin(nameInput.trim()); } finally { joining = false; }
    }

    async function save(slot) {
        const value = (drafts[slot.slotId] ?? "").trim();
        if (!value) return;
        savingSlot = slot.slotId;
        try { await onSubmitWord(slot.slotId, value); } finally { savingSlot = null; }
    }

    async function swap(slot) {
        if (slot.swapped || swappingSlot) return;
        swapError = "";
        swappingSlot = slot.slotId;
        try {
            const { ok, data } = await onSwapPrompt(slot.slotId);
            if (!ok) {
                const msg = {
                    already_swapped: "You already swapped that one.",
                    no_alternatives: "No other prompts left in this deck.",
                    not_writing: "Too late — the round moved on.",
                }[data?.error] || "Could not swap — try again.";
                swapError = msg;
                return;
            }
            drafts = { ...drafts, [slot.slotId]: "" };
        } finally {
            swappingSlot = null;
        }
    }

    async function pick(item) {
        if (voting || you?.hasVoted) return;
        voting = true;
        try { await onVote(item.id); } finally { voting = false; }
    }

    const ballot = $derived((gameState?.ballot ?? []).filter((i) => i.authorId !== player?.playerId));
</script>

<div class="player">
    {#if sessionMissing}
        <div class="card center">
            <h1 class="title">Hmm.</h1>
            <p>No game found for code <strong>{code}</strong>. Double-check with the host.</p>
        </div>
    {:else if !player}
        <form class="card" onsubmit={join}>
            <h1 class="title">{gameTitle}</h1>
            <p class="sub">Room <strong>{code}</strong>. What should we call you?</p>
            <input
                bind:value={nameInput}
                placeholder="Your name (or alias)"
                maxlength="40"
                autocomplete="off"
                required
                disabled={joining}
            />
            <button class="primary" type="submit" disabled={joining || !nameInput.trim()}>
                {joining ? "Joining…" : "I'm in"}
            </button>
        </form>

    {:else if phase === "lobby"}
        <div class="card center">
            <div class="big-emoji">🍻</div>
            <h1 class="title">You're in, {player.name}.</h1>
            <p class="sub">Hang tight — the host is about to start.</p>
        </div>

    {:else if phase === "writing"}
        {#if you?.assigned}
            <div class="head">
                <h1 class="title">Your prompts</h1>
                <p class="sub">Match the type before the dash (Brand, Insult, Place…). One word or a short phrase — no sentences.</p>
            </div>
            <div class="slots">
                {#each slots as slot (`${writingEpoch}-${slot.slotId}`)}
                    <div class="slot {isSaved(slot) ? 'saved' : ''}">
                        <div class="slot-prompt-row">
                            <div class="slot-prompt">{slot.prompt}</div>
                            {#if !slot.swapped}
                                <button
                                    type="button"
                                    class="swap-btn"
                                    onclick={() => swap(slot)}
                                    disabled={swappingSlot === slot.slotId}
                                    title="Replace this prompt once"
                                >
                                    {swappingSlot === slot.slotId ? "…" : "Swap"}
                                </button>
                            {:else}
                                <span class="swapped-tag">Swapped</span>
                            {/if}
                        </div>
                        <div class="slot-row">
                            <input
                                bind:value={drafts[slot.slotId]}
                                placeholder="type something…"
                                maxlength="120"
                                onkeydown={(e) => { if (e.key === "Enter") save(slot); }}
                            />
                            <button
                                class="save-btn"
                                onclick={() => save(slot)}
                                disabled={savingSlot === slot.slotId || !(drafts[slot.slotId] ?? "").trim()}
                            >
                                {isSaved(slot) ? "✓" : savingSlot === slot.slotId ? "…" : "Save"}
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
            {#if swapError}<p class="swap-error">{swapError}</p>{/if}
            {#if allSaved}
                <p class="done-note">All locked in. Sit back and watch the big screen.</p>
            {/if}
        {:else}
            <div class="card center">
                <h1 class="title">Round in progress</h1>
                <p class="sub">You'll get prompts in the next round. Watch the big screen.</p>
            </div>
        {/if}

    {:else if phase === "generating"}
        <div class="card center">
            <div class="spinner"></div>
            <h1 class="title">Cooking…</h1>
            <p class="sub">Watch the big screen.</p>
        </div>

    {:else if phase === "reveal"}
        <div class="card center">
            <div class="big-emoji">📖</div>
            <h1 class="title">Story time</h1>
            <p class="sub">Eyes on the big screen — your words are in there somewhere.</p>
        </div>

    {:else if phase === "voting"}
        {#if you?.hasVoted}
            <div class="card center">
                <div class="big-emoji">🗳️</div>
                <h1 class="title">Vote locked.</h1>
                <p class="sub">Waiting on everyone else to vote…</p>
            </div>
        {:else}
            <div class="head">
                <h1 class="title">Pick round MVP</h1>
                <p class="sub">Tap the best contribution (not your own).</p>
            </div>
            <div class="slots">
                {#each ballot as item}
                    <button class="vote-card" onclick={() => pick(item)} disabled={voting}>
                        <span class="slot-prompt">{item.prompt}</span>
                        <span class="vote-value">“{item.value}”</span>
                    </button>
                {/each}
            </div>
        {/if}

    {:else if phase === "results"}
        <div class="card center">
            {#if gameState?.mvp}
                <div class="big-emoji">🏆</div>
                <h1 class="title">{gameState.mvp.name} takes it</h1>
                <p class="sub">“{gameState.mvp.value}”</p>
            {:else}
                <h1 class="title">Nobody voted 🦗</h1>
            {/if}
            <p class="sub">Next round coming up — watch the big screen.</p>
        </div>

    {:else if phase === "finished"}
        <div class="card center">
            <div class="big-emoji">👑</div>
            <h1 class="title">That's a wrap!</h1>
            <p class="sub">Thanks for playing!</p>
        </div>
    {:else}
        <div class="card center">
            <div class="spinner"></div>
            <p class="sub">Connecting…</p>
        </div>
    {/if}

    {#if netError}<div class="net-note">{netError}</div>{/if}
</div>

<style>
    .player {
        max-width: 560px;
        margin: 0 auto;
        padding: 1.5rem 1.1rem 4rem;
        min-height: 100vh;
    }
    .head { margin-bottom: 1.25rem; }
    .title {
        font-family: 'Fraunces', serif;
        font-weight: 700;
        font-size: clamp(1.6rem, 7vw, 2.2rem);
        letter-spacing: -0.02em;
        color: var(--header-colour);
        margin: 0 0 0.4rem;
    }
    .sub { opacity: 0.8; margin: 0; font-size: 1rem; }

    .card {
        background: var(--item-background);
        border: var(--item-border);
        border-radius: 16px;
        padding: 1.75rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
        margin-top: 8vh;
    }
    .card.center { text-align: center; align-items: center; }
    .big-emoji { font-size: 3.5rem; line-height: 1; }

    input {
        font: inherit;
        width: 100%;
        box-sizing: border-box;
        color: var(--header-colour);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--main-green-translucent);
        border-radius: 10px;
        padding: 0.75rem 0.9rem;
        outline: none;
    }
    input:focus { border-color: var(--main-green); }

    .slots { display: flex; flex-direction: column; gap: 0.9rem; }
    .slot {
        background: var(--item-background);
        border: var(--item-border);
        border-radius: 14px;
        padding: 1rem;
        transition: border-color 0.15s ease;
    }
    .slot.saved { border-color: var(--main-green); }
    .slot-prompt-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.55rem;
    }
    .slot-prompt {
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--main-green);
        flex: 1;
        min-width: 0;
    }
    .swap-btn {
        font: inherit;
        font-size: 0.72rem;
        font-weight: 600;
        flex-shrink: 0;
        cursor: pointer;
        color: var(--header-colour);
        background: transparent;
        border: 1px solid var(--main-green-translucent);
        border-radius: 8px;
        padding: 0.25rem 0.55rem;
        transition: border-color 0.15s ease, color 0.15s ease;
    }
    .swap-btn:hover:not(:disabled) {
        border-color: var(--main-green);
        color: var(--main-green);
    }
    .swap-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .swapped-tag {
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.45;
        flex-shrink: 0;
    }
    .swap-error {
        margin-top: 0.75rem;
        text-align: center;
        font-size: 0.9rem;
        color: #e8a87c;
    }
    .slot-row { display: flex; gap: 0.5rem; }
    .slot-row input { flex: 1; }

    .save-btn {
        font: inherit; font-weight: 600; cursor: pointer;
        min-width: 3.2rem;
        background: var(--main-green); color: var(--background-one);
        border: none; border-radius: 10px; padding: 0 0.9rem;
        transition: opacity 0.15s ease;
    }
    .save-btn:disabled { opacity: 0.45; cursor: not-allowed; }

    .done-note {
        margin-top: 1.25rem; text-align: center;
        color: var(--main-green); font-weight: 600;
    }

    .vote-card {
        font: inherit; text-align: left; cursor: pointer;
        display: flex; flex-direction: column; gap: 0.3rem;
        background: var(--item-background);
        border: var(--item-border);
        border-radius: 14px;
        padding: 1rem;
        color: var(--header-colour);
        transition: border-color 0.15s ease, transform 0.1s ease;
    }
    .vote-card:hover:not(:disabled) { border-color: var(--main-green); }
    .vote-card:active:not(:disabled) { transform: scale(0.98); }
    .vote-card:disabled { opacity: 0.6; cursor: not-allowed; }
    .vote-value { font-size: 1.1rem; }

    .primary {
        font: inherit; font-weight: 600; cursor: pointer;
        background: var(--main-green); color: var(--background-one);
        border: none; border-radius: 10px; padding: 0.8rem 1rem;
        transition: opacity 0.15s ease, transform 0.1s ease;
    }
    .primary:hover:not(:disabled) { opacity: 0.92; }
    .primary:active:not(:disabled) { transform: scale(0.98); }
    .primary:disabled { opacity: 0.45; cursor: not-allowed; }

    .spinner {
        width: 44px; height: 44px; margin: 0 auto 0.5rem;
        border: 4px solid var(--main-green-translucent);
        border-top-color: var(--main-green);
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .net-note {
        position: fixed; bottom: 0.75rem; left: 50%; transform: translateX(-50%);
        font-size: 0.78rem; opacity: 0.6;
    }
</style>
