<!-- Top bar shown on every in-session host phase: room code, round leader, new-game. -->
<script>
    let { code, leaderboard = [], busy = false, onReset } = $props();
</script>

<header class="bar">
    <div class="bar-code">
        <span class="bar-code-label">Room</span>
        <span class="bar-code-value">{code}</span>
    </div>
    {#if leaderboard.length > 0}
        <div class="bar-leader">
            <span class="bar-code-label">Round leader</span>
            <span class="bar-leader-name">{leaderboard[0].name} · {leaderboard[0].points}</span>
        </div>
    {/if}
    <button class="ghost small" onclick={onReset} disabled={busy}>New game</button>
</header>
