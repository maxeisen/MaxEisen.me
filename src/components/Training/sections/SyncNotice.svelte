<!--
    Says so when the numbers below aren't the whole story.

    Only the scheduled sync writes the Strava history, and it fills the block in
    batches, so there are two states where the dashboard renders perfectly well
    while describing a block that didn't happen: before the first sync (every
    metric zero) and during a backfill (a truncated history, which reads as a
    much lower CTL than the athlete has). Both used to look exactly like a
    finished page reporting bad training.
-->
<script>
    let { sync = null, runCount = 0 } = $props();

    const state = $derived.by(() => {
        if (!sync) return null;
        if (!sync.hasSynced && runCount === 0) {
            return {
                title: "Waiting for the first sync",
                detail:
                    "Strava history is imported on a schedule rather than on page load, so nothing has landed here yet. This page fills in within about 10 minutes of going live.",
            };
        }
        if (sync.backfilling) {
            const runs = sync.outstanding === 1 ? "1 run" : `${sync.outstanding} runs`;
            return {
                title: `Still importing — ${runs} to go`,
                detail:
                    "Fitness, form and the race projection all read the whole block, so treat them as provisional until the import finishes. The most recent weeks are already accurate.",
            };
        }
        return null;
    });
</script>

{#if state}
    <div class="notice" role="status">
        <span class="dot" aria-hidden="true"></span>
        <div>
            <strong>{state.title}</strong>
            <p>{state.detail}</p>
        </div>
    </div>
{/if}

<style>
    .notice {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-4);
        margin-bottom: var(--space-5);
        border-radius: var(--radius-md);
        background: var(--inner-background);
        border: 1px solid var(--main-green-translucent);
    }
    .dot {
        flex: none;
        width: 8px;
        height: 8px;
        margin-top: 6px;
        border-radius: 50%;
        background: var(--main-green);
        animation: pulse 1.8s ease-in-out infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 0.35; }
        50% { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
        .dot { animation: none; opacity: 0.8; }
    }
    strong {
        display: block;
        font-family: var(--font-serif);
        font-size: var(--font-sm);
        font-weight: 600;
        color: var(--header-colour);
    }
    p {
        font-size: var(--font-xs);
        line-height: 1.6;
        color: var(--paragraph-colour);
        opacity: 0.75;
        margin: var(--space-1) 0 0 0;
        max-width: 70ch;
    }
</style>
