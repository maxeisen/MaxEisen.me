<!-- Projected finish: training-supported headline, aerobic equivalent, range. -->
<script>
    import ChartLegend from "../../Activity/charts/ChartLegend.svelte";
    import Card from "../../../lib/ui/Card.svelte";
    import ChartFrame from "../../Activity/charts/ChartFrame.svelte";
    import Stat from "../../../lib/ui/Stat.svelte";
    import StatGrid from "../../../lib/ui/StatGrid.svelte";
    import Tag from "../../../lib/ui/Tag.svelte";
    import { gaugePosition, niceScale, scaleLinear, smoothPath, xPct, yPct } from "../../Activity/lib/chart.js";
    import { inBlock, lastRace } from "../lib/block.js";
    import { clock, clockMinutes, daysAgo, gapDuration, km, pace, shortDate, signedClock } from "../../Activity/lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { summary = null } = $props();

    const event = $derived(inBlock(summary));
    const prediction = $derived(summary?.prediction || null);
    const race = $derived(summary?.race || {});
    const basis = $derived(prediction?.basis || null);
    const range = $derived(prediction?.range || null);
    const history = $derived(prediction?.history || []);
    // Between blocks, the finish you actually ran is the yardstick the
    // estimate is read against — the goal belonged to the block.
    const finished = $derived.by(() => {
        const race = lastRace(summary);
        return race?.resultSec ? race : null;
    });
    const sinceRace = $derived(
        finished && prediction?.predictedSec > 0 ? prediction.predictedSec - finished.resultSec : null,
    );

    const WIDTH = 720;
    const HEIGHT = 110;
    const TRACK = 300;

    const historyScale = $derived.by(() => {
        const values = history.map((point) => point.predictedSec).filter((n) => n > 0);
        if (values.length < 2) return null;
        if (finished) values.push(finished.resultSec);
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
    const resultY = $derived.by(() => {
        if (!finished || !historyScale || !(historyScale.max > historyScale.min)) return null;
        return scaleLinear([historyScale.min, historyScale.max], [0, HEIGHT])(finished.resultSec);
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
                    colour: "var(--series-1)",
                    yPct: yPct(point.y, HEIGHT),
                },
            ],
        })),
    );

    const rangeDomain = $derived.by(() => {
        if (!range) return null;
        const values = [
            range.fastSec,
            range.slowSec,
            prediction.predictedSec,
            event ? race.goalTimeSec : null,
            finished?.resultSec,
        ].filter((n) => n > 0);
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
    const resultMarker = $derived(
        rangeDomain && finished ? gaugePosition(finished.resultSec, rangeDomain, TRACK) : null,
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

<Card title={event ? "Projected finish" : "Marathon estimate"} info={GLOSSARY.prediction}>
    {#if !prediction}
        <p class="card-empty">
            Not enough recent running to project from. A few weeks of volume, or a race-quality
            effort of 5&nbsp;km or longer, fills this in.
        </p>
    {:else}
        <div class="headline">
            <Stat
                size="xl"
                label={event ? "Projected" : "If raced today"}
                value={clockMinutes(prediction.predictedSec)}
                tone={event ? (prediction.onTrack ? "good" : prediction.onTrack === false ? "bad" : null) : null}
            />
            {#if event}
                <Tag tone={prediction.onTrack ? "good" : "bad"} size="md">{signedClock(prediction.deltaSec)}</Tag>
                {#if prediction.confidence?.label}
                    <span class="confidence">{prediction.confidence.label} confidence</span>
                {/if}
            {/if}
        </div>

        {#if range && rangeDomain}
            <div class="range-wrap">
                <svg viewBox="0 0 {TRACK} 24" class="range" role="img" aria-label="Likely race-day range">
                    <rect class="track" x="0" y="8" width={TRACK} height="8" rx="4" />
                    <rect class="band" x={rangeStart} y="8" width={Math.max(2, rangeEnd - rangeStart)} height="8" rx="4" />
                    {#if event && goalMarker !== null}
                        <line class="goal" x1={goalMarker} x2={goalMarker} y1="3" y2="21" />
                    {/if}
                    {#if resultMarker !== null}
                        <line class="result" x1={resultMarker} x2={resultMarker} y1="3" y2="21">
                            <title>{finished.isMarathon ? "Last marathon" : "Last race"} {clock(finished.resultSec)}</title>
                        </line>
                    {/if}
                    {#if rangeMarker !== null}
                        <line class="marker" x1={rangeMarker} x2={rangeMarker} y1="1" y2="23" />
                    {/if}
                </svg>
                <!-- A legend rather than end labels: a goal or a past finish
                     outside the range stretches the track, so its ends are
                     no longer the range's. -->
                <div class="range-labels">
                    {#if event && goalMarker !== null}
                        <span><span class="key-tick goal-tick"></span>Goal {clock(race.goalTimeSec)}</span>
                    {:else if resultMarker !== null}
                        <span><span class="key-tick result-tick"></span>{finished.isMarathon ? "Last marathon" : "Last race"} {clock(finished.resultSec)}</span>
                    {/if}
                    <span class="key-range"><span class="key-band"></span>Likely {clockMinutes(range.fastSec)}–{clockMinutes(range.slowSec)}</span>
                </div>
            </div>
        {/if}

        <div class="section">
            <StatGrid rule="top" min={96}>
                <Stat label="Training" value={clockMinutes(prediction.trainingSec)} />
                <Stat
                    label="Aerobic"
                    value={clockMinutes(prediction.aerobicPotentialSec)}
                    note={Number.isFinite(prediction.vdot) ? `VDOT ${prediction.vdot.toFixed(1)}` : null}
                />
                {#if event}
                    <Stat label="Goal pace" value={pace(race.goalPaceSecPerKm)} />
                {:else if finished}
                    <div class="last-race">
                        <Stat
                            label={finished.isMarathon ? "Last marathon" : "Last race"}
                            value={clock(finished.resultSec)}
                            note={Number.isFinite(sinceRace) && Math.abs(sinceRace) >= 30
                                ? `${gapDuration(sinceRace)} ${sinceRace > 0 ? "slower" : "faster"} now`
                                : Number.isFinite(sinceRace)
                                    ? "estimate matches it"
                                    : finished.dateLabel}
                        />
                    </div>
                {/if}
            </StatGrid>
        </div>

        {#if history.length > 1 && historyScale}
            <div class="section">
                <ChartFrame height={120} {yTicks} {xTicks} {scrub} label="Projected finish over recent weeks">
                    <svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none">
                        {#if resultY !== null}
                            <line class="result-line" x1="0" x2={WIDTH} y1={resultY} y2={resultY} />
                        {/if}
                        <path class="history-line" d={smoothPath(historyPoints)} />
                    </svg>
                </ChartFrame>
                <ChartLegend
                    under
                    items={[
                        { label: "Projection over time", color: "var(--series-1)" },
                        ...(finished ? [{ label: `${finished.isMarathon ? "Last marathon" : "Last race"}, ${clock(finished.resultSec)} on ${finished.dateLabel}`, color: "var(--tone-good)", mark: "dash" }] : []),
                    ]}
                />
            </div>
        {/if}

        {#if prediction.factors?.length}
            <div class="section">
                <StatGrid rule="top" min={140} gap={3}>
                    {#each prediction.factors as factor (factor.id)}
                        <Stat
                            size="sm"
                            label={factor.label}
                            value={factor.value || "—"}
                            tone={factor.tone === "supporting" ? "good" : factor.tone === "limiting" ? "bad" : null}
                        />
                    {/each}
                </StatGrid>
            </div>
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
        align-items: flex-end;
        gap: var(--space-3) var(--space-4);
        flex-wrap: wrap;
    }
    .confidence {
        margin-left: auto;
        font-size: var(--font-xs);
        color: var(--text-2);
    }

    .range-wrap { margin-top: var(--space-5); }
    .range { width: 100%; height: 24px; display: block; }
    .track { fill: var(--surface-2); }
    .band { fill: var(--series-1); opacity: 0.3; }
    .marker { stroke: var(--text-strong); stroke-width: 2.5; stroke-linecap: round; }
    .goal { stroke: var(--text-2); stroke-width: 2; stroke-dasharray: 3 3; }
    /* The finish you ran: solid, where the goal it replaced is dashed. */
    .result { stroke: var(--tone-good); stroke-width: 2.5; stroke-linecap: round; }

    .range-labels {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-3);
        margin-top: var(--space-1);
        font-size: var(--font-2xs);
        color: var(--text-2);
    }
    .range-labels > span { display: inline-flex; align-items: center; gap: 6px; }
    .key-range { margin-left: auto; }
    .key-band { width: 14px; height: 6px; border-radius: 3px; background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent); }
    .key-tick { width: 0; height: 11px; }
    .goal-tick { width: 2px; background: repeating-linear-gradient(to bottom, var(--text-2) 0 3px, transparent 3px 6px); }
    .result-tick { border-left: 2.5px solid var(--tone-good); }

    .section { margin-top: var(--space-5); }
    .last-race :global(.stat-value) { color: var(--tone-good); }

    .history-line {
        fill: none;
        stroke: var(--series-1);
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
    }
    .result-line {
        stroke: var(--tone-good);
        stroke-width: 1.5;
        stroke-dasharray: 5 4;
        vector-effect: non-scaling-stroke;
    }

    .basis {
        margin: var(--space-4) 0 0;
        font-size: var(--font-xs);
        line-height: 1.55;
        color: var(--text-2);
    }
</style>
