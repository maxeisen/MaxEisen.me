<!--
    Projected finish against the goal.

    The headline is a readiness-adjusted marathon time, rounded to the minute.
    Riegel and VDOT stay visible as aerobic potential — the optimistic ceiling
    from shorter races — and a handful of deterministic factors explain why
    the two diverge.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import { clockMinutes, km, pace, shortDate, signedClock } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { summary = null } = $props();

    const prediction = $derived(summary?.prediction || null);
    const race = $derived(summary?.race || {});
    const basis = $derived(prediction?.basis || null);
    const range = $derived(prediction?.projectionRange || null);
    const explanations = $derived(prediction?.explanations || []);
    const readinessPct = $derived(
        Number.isFinite(prediction?.marathonReadiness)
            ? Math.round(prediction.marathonReadiness * 100)
            : null,
    );
    const factorRows = $derived.by(() => {
        const scores = prediction?.factors;
        if (!scores) return [];
        const labels = {
            volume: "Sustained volume",
            longRuns: "Long-run development",
            decoupling: "Aerobic stability",
            consistency: "Training consistency",
            frequency: "Run frequency",
            fitnessTrend: "Fitness trend",
            recovery: "Recovery",
        };
        return Object.entries(labels)
            .filter(([key]) => Number.isFinite(scores[key]))
            .map(([key, label]) => ({ key, label, pct: Math.round(scores[key] * 100) }));
    });
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
                <strong>{clockMinutes(prediction.predictedSec)}</strong>
                <span>projected</span>
            </div>
            <div class="delta" class:ahead={prediction.onTrack}>
                {signedClock(prediction.deltaSec)}
            </div>
        </div>

        {#if range}
            <p class="range">
                Likely range {clockMinutes(range.fastSec)}–{clockMinutes(range.slowSec)}
            </p>
        {/if}

        <div class="models">
            <div class="model">
                <span class="model-label">Aerobic potential</span>
                <strong>{clockMinutes(Number.isFinite(prediction.aerobicPotentialSeconds) ? prediction.aerobicPotentialSeconds : prediction.predictedSec)}</strong>
                <span class="model-note">
                    VDOT {clockMinutes(prediction.vdotSec)} · Riegel {clockMinutes(prediction.riegelSec)}
                </span>
            </div>
            <div class="model">
                <span class="model-label">Marathon readiness</span>
                <strong>{readinessPct !== null ? `${readinessPct}%` : "—"}</strong>
                <span class="model-note">
                    {prediction.confidenceLabel ? `${prediction.confidenceLabel} confidence` : "from completed training"}
                </span>
            </div>
            <div class="model">
                <span class="model-label">Goal pace</span>
                <strong>{pace(race.goalPaceSecPerKm)}</strong>
            </div>
        </div>

        {#if prediction.raceDay}
            <p class="raceday">
                If remaining planned training is completed conservatively:
                {clockMinutes(prediction.raceDay.predictedSec)}
                ({Math.round(prediction.raceDay.marathonReadiness * 100)}% readiness).
            </p>
        {/if}

        {#if explanations.length}
            <ul class="factors">
                {#each explanations as item}
                    <li class={item.direction}>
                        <span>{item.direction === "limiting" ? "Limiting" : "Positive"}</span>
                        {item.text}
                    </li>
                {/each}
            </ul>
        {/if}

        {#if factorRows.length}
            <details class="breakdown">
                <summary>How readiness was scored</summary>
                <ul>
                    {#each factorRows as row}
                        <li>
                            <span>{row.label}</span>
                            <strong>{row.pct}%</strong>
                        </li>
                    {/each}
                </ul>
                {#if basis}
                    <p>
                        Aerobic potential from your {km(basis.distanceM)} best effort of {clockMinutes(basis.timeSec)}
                        {#if basis.date}on {shortDate(basis.date)}{/if}.
                    </p>
                {/if}
            </details>
        {:else if basis}
            <p class="basis">
                Projected from your {km(basis.distanceM)} best effort of {clockMinutes(basis.timeSec)}
                {#if basis.date}on {shortDate(basis.date)}{/if}.
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
        font-family: var(--font-sans);
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

    .range {
        margin: var(--space-3) 0 0 0;
        font-size: var(--font-sm);
        color: var(--paragraph-colour);
        opacity: 0.8;
    }

    .models {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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
        font-family: var(--font-sans);
        font-size: var(--font-md);
        font-weight: 600;
        color: var(--header-colour);
    }
    .model-note {
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.6;
        line-height: 1.4;
    }

    .raceday {
        margin: var(--space-4) 0 0 0;
        font-size: var(--font-xs);
        color: var(--paragraph-colour);
        opacity: 0.75;
        line-height: 1.5;
    }

    .factors {
        list-style: none;
        margin: var(--space-5) 0 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }
    .factors li {
        font-size: var(--font-xs);
        line-height: 1.45;
        color: var(--paragraph-colour);
        padding-left: var(--space-3);
        border-left: 3px solid var(--main-green-translucent);
    }
    .factors li span {
        display: block;
        font-size: var(--font-2xs);
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 1px;
        color: var(--main-green);
    }
    .factors li.limiting { border-left-color: var(--tone-bad); }
    .factors li.limiting span { color: var(--tone-bad); }
    .factors li.positive { border-left-color: var(--tone-good); }
    .factors li.positive span { color: var(--tone-good); }

    .breakdown {
        margin-top: var(--space-4);
        font-size: var(--font-xs);
        color: var(--paragraph-colour);
    }
    .breakdown summary {
        cursor: pointer;
        color: var(--main-green);
        font-weight: 600;
        letter-spacing: 0.04em;
    }
    .breakdown ul {
        list-style: none;
        margin: var(--space-3) 0 0 0;
        padding: 0;
        display: grid;
        gap: var(--space-2);
    }
    .breakdown li {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
        opacity: 0.85;
    }
    .breakdown p {
        margin: var(--space-3) 0 0 0;
        opacity: 0.7;
        line-height: 1.5;
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
