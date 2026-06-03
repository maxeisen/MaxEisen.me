<!-- Voting phase (phone): tap the best contribution (own entries filtered out upstream). -->
<script>
    let { ballot = [], onVote } = $props();

    let voting = $state(false);

    async function pick(item) {
        if (voting) return;
        voting = true;
        try { await onVote(item.id); } finally { voting = false; }
    }
</script>

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
