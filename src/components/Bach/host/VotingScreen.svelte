<!-- Voting phase: the ballot preview + tally trigger. Narration (if playing)
     continues above via NarrationPlayer, which HostScreen keeps mounted. -->
<script>
    let { gameState, players = [], busy = false, onTally } = $props();
</script>

<section class="centered">
    <h2 class="display sm">Vote for round MVP</h2>
    <p class="muted">Open your phone and crown the best contribution. {gameState?.voteCount ?? 0} / {players.length} voted.</p>
    <ul class="ballot-preview">
        {#each gameState?.ballot ?? [] as item}
            <li><span class="ballot-prompt">{item.prompt}</span> “{item.value}”</li>
        {/each}
    </ul>
    <button class="primary big" onclick={onTally} disabled={busy}>Reveal the MVP</button>
</section>
