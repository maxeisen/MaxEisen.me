<!-- Results phase: round MVP + leaderboard, then end-game or next-round. -->
<script>
    let {
        mvp = null,
        leaderboard = [],
        players = [],
        busy = false,
        onFinish,
        onNextRound,
    } = $props();
</script>

<section class="centered">
    {#if mvp}
        <div class="trophy">🏆</div>
        <h2 class="display sm">Round MVP: {mvp.name}</h2>
        <p class="mvp-quote">“{mvp.value}”</p>
        <p class="muted">for <em>{mvp.prompt}</em> · {mvp.votes} vote{mvp.votes === 1 ? "" : "s"}</p>
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
        <button class="ghost" onclick={onFinish} disabled={busy}>End game</button>
        <button class="primary" onclick={onNextRound} disabled={busy || players.length === 0}>Next round →</button>
    </div>
</section>
