<!-- Finished phase: overall leader + final leaderboard, then start a new game. -->
<script>
    let { leaderboard = [], busy = false, onReset } = $props();
</script>

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
    <button class="primary big" onclick={onReset} disabled={busy}>New game</button>
</section>
