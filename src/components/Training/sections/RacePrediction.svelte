<!--
    Projected finish against the goal.

    Both models are shown rather than just the headline number: they disagree,
    and by how much is informative. The headline takes the slower of the two,
    since both assume the endurance work has been done and therefore flatter a
    marathon projection made from a shorter effort.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import { clock, km, pace, shortDate, signedClock } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { summary = null } = $props();

    const prediction = $derived(summary?.prediction || null);
    const race = $derived(summary?.race || {});
    const basis = $derived(prediction?.basis || null);
</script>

<Card title="Projected finish" info={GLOSSARY.prediction}>
    {#if !prediction}
        <p class="empty">
            No hard effort of 5&nbsp;km or longer yet to project from. Race a parkrun or run a
            tempo effort and this fills in.
        </p>
    {:else}
        <div class="headline">
            <div class="projected" class:ahead={prediction.onTrack}>
                <strong>{clock(prediction.predictedSec)}</strong>
                <span>projected</span>
            </div>
            <div class="delta" class:ahead={prediction.onTrack}>
                {signedClock(prediction.deltaSec)}
            </div>
        </div>

        <div class="models">
            <div class="model">
                <span class="model-label">Riegel</span>
                <strong>{clock(prediction.riegelSec)}</strong>
            </div>
            <div class="model">
                <span class="model-label">VDOT</span>
                <strong>{clock(prediction.vdotSec)}</strong>
                {#if Number.isFinite(prediction.vdot)}
                    <span class="model-note">{prediction.vdot.toFixed(1)}</span>
                {/if}
            </div>
            <div class="model">
                <span class="model-label">Goal pace</span>
                <strong>{pace(race.goalPaceSecPerKm)}</strong>
            </div>
        </div>

        {#if basis}
            <p class="basis">
                Projected from your {km(basis.distanceM)} best effort of {clock(basis.timeSec)}
                {#if basis.date}on {shortDate(basis.date)}{/if}. Both models assume the endurance
                work continues, so treat this as a floor rather than a verdict.
            </p>
        {/if}
    {/if}
</Card>

<style>
    .headline {
        display: flex;
        align-items: baseline;
        gap: var(--space-4);
        flex-wrap: wrap;
    }
    .projected {
        display: flex;
        flex-direction: column;
        line-height: 1.05;
    }
    .projected strong {
        font-family: var(--font-serif);
        font-size: clamp(2rem, 6vw, 2.8rem);
        font-weight: 700;
        letter-spacing: -0.03em;
        color: var(--tone-bad);
    }
    .projected.ahead strong { color: var(--tone-good); }
    .projected span {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin-top: var(--space-2);
    }
    .delta {
        font-size: var(--font-sm);
        font-weight: 600;
        padding: var(--space-1) var(--space-3);
        border-radius: var(--radius-pill);
        background: var(--tone-bad-bg);
        color: var(--tone-bad);
    }
    .delta.ahead { background: var(--tone-good-bg); color: var(--tone-good); }

    .models {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: var(--space-3);
        margin-top: var(--space-5);
        padding-top: var(--space-4);
        border-top: 1px solid var(--main-green-translucent);
    }
    .model { display: flex; flex-direction: column; gap: 2px; }
    .model-label {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--main-green);
    }
    .model strong {
        font-family: var(--font-serif);
        font-size: var(--font-md);
        font-weight: 600;
        color: var(--header-colour);
    }
    .model-note {
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.6;
    }

    .basis, .empty {
        font-size: var(--font-xs);
        line-height: 1.55;
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin: var(--space-4) 0 0 0;
    }
    .empty { margin: 0; }
</style>
