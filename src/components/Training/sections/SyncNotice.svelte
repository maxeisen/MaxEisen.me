<!-- Shown when the numbers below aren't the whole history yet. -->
<script>
    let { sync = null, runCount = 0 } = $props();

    const state = $derived.by(() => {
        if (!sync) return null;
        if (!sync.hasSynced && runCount === 0) {
            return {
                title: "Waiting for the first sync",
                detail:
                    "Strava history is imported on a schedule rather than on page load, so nothing has landed here yet. This page fills in within about 5 minutes of going live.",
            };
        }
        if (sync.backfilling) {
            const runs = sync.outstanding === 1 ? "1 run" : `${sync.outstanding} runs`;
            return {
                title: `Still importing — ${runs} to go`,
                detail:
                    "Fitness and form read the whole history, so treat them as provisional until the import finishes. The most recent weeks are already accurate.",
            };
        }
        return null;
    });
</script>

{#if state}
    <div class="notice surface" role="status">
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
        padding: var(--space-3) var(--space-4);
        margin-bottom: var(--space-5);
    }
    .dot {
        flex: none;
        width: 8px;
        height: 8px;
        margin-top: 6px;
        border-radius: 50%;
        background: var(--tone-info);
        animation: pulse 1.8s ease-in-out infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 0.35; }
        50% { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
        .dot { animation: none; }
    }
    strong {
        display: block;
        font-size: var(--font-sm);
        font-weight: var(--weight-semibold);
        color: var(--text-strong);
    }
    p {
        margin: var(--space-1) 0 0;
        max-width: 70ch;
        font-size: var(--font-xs);
        line-height: 1.6;
        color: var(--text-2);
    }
</style>
