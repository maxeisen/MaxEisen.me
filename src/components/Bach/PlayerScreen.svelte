<!--
    Player (phone) controller. Routes the current game phase to a focused
    player/* card. Join / writing / voting carry their own local state inside
    their components; the simple "watch the big screen" states reuse StatusCard.
-->
<script>
    import "./lib/bach.css";
    import StatusCard from "./player/StatusCard.svelte";
    import JoinCard from "./player/JoinCard.svelte";
    import WritingCard from "./player/WritingCard.svelte";
    import VotingCard from "./player/VotingCard.svelte";

    let {
        code,
        player,
        gameTitle = "Story Builder",
        gameState,
        sessionMissing,
        netError,
        onJoin,
        onSubmitWord,
        onSwapPrompt,
        onVote,
        onExit,
    } = $props();

    const phase = $derived(gameState?.phase ?? null);
    const you = $derived(gameState?.you ?? null);
    const ballot = $derived((gameState?.ballot ?? []).filter((i) => i.authorId !== player?.playerId));
</script>

<div class="player">
    {#if onExit}
        <button type="button" class="player-leave" onclick={onExit}>← Leave room</button>
    {/if}
    {#if sessionMissing}
        <div class="card center">
            <h1 class="title">Hmm.</h1>
            <p>No game found for code <strong>{code}</strong>. Double-check with the host.</p>
        </div>
    {:else if !player}
        <JoinCard {code} {gameTitle} {onJoin} />

    {:else if phase === "lobby"}
        <StatusCard emoji="🍻" title={`You're in, ${player.name}.`} sub="Hang tight — the host is about to start." />

    {:else if phase === "writing"}
        {#if you?.assigned}
            <WritingCard
                {you}
                roundIndex={gameState?.roundIndex ?? null}
                version={gameState?.version ?? 0}
                {onSubmitWord}
                {onSwapPrompt}
            />
        {:else}
            <StatusCard title="Round in progress" sub="You'll get prompts in the next round. Watch the big screen." />
        {/if}

    {:else if phase === "generating"}
        <StatusCard spinner title="Cooking up your story…" sub="Watch the big screen." />

    {:else if phase === "reveal"}
        <StatusCard emoji="📖" title="Story time" sub="Eyes on the big screen — your words are in there somewhere." />

    {:else if phase === "voting"}
        {#if you?.hasVoted}
            <StatusCard emoji="🗳️" title="Vote locked." sub="Waiting on everyone else to vote…" />
        {:else}
            <VotingCard {ballot} {onVote} />
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
        <StatusCard emoji="👑" title="That's a wrap!" sub="Thanks for playing!" />

    {:else}
        <StatusCard spinner sub="Connecting…" />
    {/if}

    {#if netError}<div class="net-note">{netError}</div>{/if}
</div>
