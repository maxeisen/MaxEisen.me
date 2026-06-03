<!--
    Writing phase (phone): the player's prompt slots with per-slot save, swap,
    and a batched "save all". Drafts reset when the writing epoch changes (slot
    ids s0,s1,… are reused every round), then backfill new slots within it.
-->
<script>
    let { you, roundIndex = null, version = 0, onSubmitWord, onSwapPrompt } = $props();

    const slots = $derived(you?.slots ?? []);
    // roundIndex alone isn't enough (a reset game starts at 0 again) — pair with
    // host version, which bumps on every phase change.
    const writingEpoch = $derived(roundIndex != null ? `${roundIndex}:${version}` : null);

    let drafts = $state({});
    let draftsEpoch = $state(null);
    let savingSlot = $state(null);
    let savingAll = $state(false);
    let saveAllError = $state("");
    let swappingSlot = $state(null);
    let swapError = $state("");

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
    const unsavedSlots = $derived(
        slots.filter((s) => {
            const value = (drafts[s.slotId] ?? "").trim();
            return value && !isSaved(s);
        }),
    );
    const canSaveAll = $derived(unsavedSlots.length > 0);

    async function save(slot) {
        const value = (drafts[slot.slotId] ?? "").trim();
        if (!value || savingAll) return;
        savingSlot = slot.slotId;
        saveAllError = "";
        try { await onSubmitWord(slot.slotId, value); } finally { savingSlot = null; }
    }

    async function saveAll() {
        if (!canSaveAll || savingAll || savingSlot) return;
        saveAllError = "";
        savingAll = true;
        try {
            const batch = unsavedSlots.filter((s) => (drafts[s.slotId] ?? "").trim());
            for (let i = 0; i < batch.length; i++) {
                const slot = batch[i];
                const value = (drafts[slot.slotId] ?? "").trim();
                // Only refresh game state once, after the final save.
                const skipPoll = i < batch.length - 1;
                const ok = await onSubmitWord(slot.slotId, value, skipPoll);
                if (!ok) {
                    saveAllError = "Something didn't save — check your connection and try again.";
                    return;
                }
            }
        } finally {
            savingAll = false;
        }
    }

    async function swap(slot) {
        if (slot.swapped || swappingSlot) return;
        swapError = "";
        swappingSlot = slot.slotId;
        try {
            const { ok, data } = await onSwapPrompt(slot.slotId);
            if (!ok) {
                swapError = {
                    already_swapped: "You already swapped that one.",
                    no_alternatives: "No other prompts left in this deck.",
                    not_writing: "Too late — the round moved on.",
                }[data?.error] || "Could not swap — try again.";
                return;
            }
            drafts = { ...drafts, [slot.slotId]: "" };
        } finally {
            swappingSlot = null;
        }
    }
</script>

<div class="head">
    <h1 class="title">Your prompts</h1>
    <p class="sub">Answer in one word or a short phrase (2–4 words) — no full sentences. The story weaver works it in.</p>
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
                    placeholder="a word or two…"
                    maxlength="120"
                    onkeydown={(e) => { if (e.key === "Enter") save(slot); }}
                />
                <button
                    class="save-btn"
                    onclick={() => save(slot)}
                    disabled={savingAll || savingSlot === slot.slotId || !(drafts[slot.slotId] ?? "").trim()}
                >
                    {isSaved(slot) ? "✓" : savingSlot === slot.slotId ? "…" : "Save"}
                </button>
            </div>
        </div>
    {/each}
</div>
{#if swapError}<p class="swap-error">{swapError}</p>{/if}
{#if saveAllError}<p class="swap-error">{saveAllError}</p>{/if}
<div class="save-all-row">
    <button
        type="button"
        class="primary save-all-btn"
        onclick={saveAll}
        disabled={!canSaveAll || savingAll || savingSlot != null || swappingSlot != null}
    >
        {#if savingAll}
            Saving…
        {:else if canSaveAll}
            Save all ({unsavedSlots.length})
        {:else if allSaved}
            All saved ✓
        {:else}
            Fill in your answers
        {/if}
    </button>
</div>
{#if allSaved}
    <p class="done-note">All locked in. Sit back and watch the big screen.</p>
{/if}
