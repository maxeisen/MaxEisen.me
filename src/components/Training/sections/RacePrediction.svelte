<!-- Projected finish: training-supported headline, aerobic equivalent, range. -->
<script>
    import Card from "../Card.svelte";
    import ChartFrame from "../charts/ChartFrame.svelte";
    import { gaugePosition, niceScale, scaleLinear, smoothPath, xPct, yPct } from "../lib/chart.js";
    import { clock, clockMinutes, daysAgo, km, pace, shortDate, signedClock } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { summary = null } = $props();

    const prediction = $derived(summary?.prediction || null);
    const race = $derived(summary?.race || {});
    const basis = $derived(prediction?.basis || null);
    const range = $derived(prediction?.range || null);
    const history = $derived(prediction?.history || []);

    const WIDTH = 720;
    const HEIGHT = 110;
    const TRACK = 300;

    const historyScale = $derived.by(() => {
        const values = history.map((point) => point.predictedSec).filter((n) => n > 0);
        if (values.length < 2) return null;
        return niceScale(
            [Math.min(...values), Math.max(...values)],
            2,
            { steps: [300, 600, 900] },
        );
    });
    // Faster finishes sit higher: the axis is time, but improvement reads up.
    const yTicks = $derived.by(() => {
        if (!historyScale || !(historyScale.max > historyScale.min)) return [];
        return historyScale.ticks.map((value) => ({
            value,
            label: clockMinutes(value),
            pct: ((historyScale.max - value) / (historyScale.max - historyScale.min)) * 100,
        }));
    });
    const historyPoints = $derived.by(() => {
        if (!historyScale || history.length === 0) return [];
        const y = scaleLinear([historyScale.min, historyScale.max], [0, HEIGHT]);
        const step = history.length === 1 ? 0 : WIDTH / (history.length - 1);
        return history.map((point, i) => ({
            x: i * step,
            y: y(point.predictedSec),
            value: point.predictedSec,
        }));
    });
    const xTicks = $derived.by(() => {
        if (history.length < 2) return [];
        const middle = history[Math.floor(history.length / 2)];
        return [
            { key: "first", label: shortDate(history[0].date), pct: 0, anchor: "start" },
            { key: "mid", label: shortDate(middle.date), pct: 50, anchor: "middle" },
            { key: "last", label: shortDate(history.at(-1).date), pct: 100, anchor: "end" },
        ];
    });
    const scrub = $derived(
        historyPoints.map((point, i) => ({
            key: history[i].date,
            pct: xPct(point.x, WIDTH),
            label: shortDate(history[i].date),
            readouts: [
                {
                    label: "Projected",
                    value: clockMinutes(history[i].predictedSec),
                    colour: "var(--main-green)",
                    yPct: yPct(point.y, HEIGHT),
                },
            ],
        })),
    );

    const rangeDomain = $derived.by(() => {
        if (!range) return null;
        const values = [range.fastSec, range.slowSec, prediction.predictedSec, race.goalTimeSec]
            .filter((n) => n > 0);
        if (values.length < 2) return null;
        const pad = 60;
        return [Math.min(...values) - pad, Math.max(...values) + pad];
    });
    const rangeMarker = $derived(
        rangeDomain ? gaugePosition(prediction.predictedSec, rangeDomain, TRACK) : null,
    );
    const rangeStart = $derived(rangeDomain ? gaugePosition(range.fastSec, rangeDomain, TRACK) : 0);
    const rangeEnd = $derived(rangeDomain ? gaugePosition(range.slowSec, rangeDomain, TRACK) : 0);
    const goalMarker = $derived(
        rangeDomain && race.goalTimeSec > 0 ? gaugePosition(race.goalTimeSec, rangeDomain, TRACK) : null,
    );

    const basisNote = $derived.by(() => {
        if (!basis) {
            return prediction?.unchangedReason
                || "No race-quality effort of 5 km or longer yet. The headline is what the last eight weeks of running support.";
        }
        const age = daysAgo(prediction.basisAgeDays);
        const when = basis.date ? `on ${shortDate(basis.date)}` : "";
        const stale = prediction.basisStatus === "historic"
            ? "Kept as historic aerobic potential — it does not set the headline."
            : "A recent race-quality effort, so it can set the aerobic equivalent.";
        return `Aerobic equivalent from your ${km(basis.distanceM)} of ${clock(basis.timeSec)} ${when}${age ? ` (${age.toLowerCase()})` : ""}. ${stale}`;
    });
</script>

<Card title="Projected finish" info={GLOSSARY.prediction}>
    {#if !prediction}
        <p class="empty">
            Not enough recent running to project from. A few weeks of volume, or a race-quality
            effort of 5&nbsp;km or longer, fills this in.
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
            {#if prediction.confidence?.label}
                <div class="confidence">{prediction.confidence.label} confidence</div>
            {/if}
        </div>

        {#if range && rangeDomain}
            <div class="range-wrap">
                <svg viewBox="0 0 {TRACK} 36" class="range" role="img" aria-label="Likely race-day range">
                    <rect class="track" x="0" y="14" width={TRACK} height="8" rx="4" />
                    <rect class="band" x={rangeStart} y="14" width={Math.max(2, rangeEnd - rangeStart)} height="8" rx="4" />
                    {#if goalMarker !== null}
                        <line class="goal" x1={goalMarker} x2={goalMarker} y1="8" y2="28" />
                    {/if}
                    {#if rangeMarker !== null}
                        <line class="marker" x1={rangeMarker} x2={rangeMarker} y1="6" y2="30" />
                    {/if}
                </svg>
                <div class="range-labels">
                    <span>{clockMinutes(range.fastSec)}</span>
                    <span>likely range</span>
                    <span>{clockMinutes(range.slowSec)}</span>
                </div>
            </div>
        {/if}

        <div class="models">
            <div class="model">
                <span class="model-label">Training</span>
                <strong>{clockMinutes(prediction.trainingSec)}</strong>
            </div>
            <div class="model">
                <span class="model-label">Aerobic</span>
                <strong>{clockMinutes(prediction.aerobicPotentialSec)}</strong>
                {#if Number.isFinite(prediction.vdot)}
                    <span class="model-note">VDOT {prediction.vdot.toFixed(1)}</span>
                {/if}
            </div>
            <div class="model">
                <span class="model-label">Goal pace</span>
                <strong>{pace(race.goalPaceSecPerKm)}</strong>
            </div>
        </div>

        {#if history.length > 1 && historyScale}
            <ChartFrame height={130} {yTicks} {xTicks} {scrub} label="Projected finish over recent weeks">
                <svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none">
                    <path class="history-line" d={smoothPath(historyPoints)} />
                </svg>
            </ChartFrame>
        {/if}

        {#if prediction.factors?.length}
            <ul class="factors">
                {#each prediction.factors as factor (factor.id)}
                    <li class="tone-{factor.tone}">
                        <span>{factor.label}</span>
                        <strong>{factor.value || "—"}</strong>
                    </li>
                {/each}
            </ul>
        {/if}

        <p class="basis">{basisNote}</p>
        {#if prediction.unchangedReason && prediction.basisStatus === "historic"}
            <p class="basis">{prediction.unchangedReason}</p>
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
    .confidence {
        font-size: var(--font-2xs);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin-left: auto;
    }

    .range-wrap { margin-top: var(--space-5); }
    .range { width: 100%; height: 36px; display: block; }
    .track { fill: var(--paragraph-colour); opacity: 0.15; }
    .band { fill: var(--main-green); opacity: 0.35; }
    .marker {
        stroke: var(--header-colour);
        stroke-width: 3;
        stroke-linecap: round;
    }
    .goal {
        stroke: var(--paragraph-colour);
        stroke-width: 2;
        stroke-dasharray: 3 3;
        opacity: 0.55;
    }
    .range-labels {
        display: flex;
        justify-content: space-between;
        font-size: var(--font-2xs);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin-top: 2px;
    }

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
        font-family: var(--font-sans);
        font-size: var(--font-md);
        font-weight: 600;
        color: var(--header-colour);
    }
    .model-note {
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.6;
    }

    .history-line {
        fill: none;
        stroke: var(--main-green);
        stroke-width: 2.25;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
    }

    .factors {
        list-style: none;
        margin: var(--space-5) 0 0 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: var(--space-3);
    }
    .factors li {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.8;
    }
    .factors strong {
        font-family: var(--font-sans);
        font-size: var(--font-sm);
        font-weight: 600;
        color: var(--header-colour);
        opacity: 1;
    }
    .factors .tone-supporting strong { color: var(--tone-good); }
    .factors .tone-limiting strong { color: var(--tone-bad); }

    .basis, .empty {
        font-size: var(--font-xs);
        line-height: 1.55;
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin: var(--space-4) 0 0 0;
    }
    .empty { margin: 0; }
</style>
