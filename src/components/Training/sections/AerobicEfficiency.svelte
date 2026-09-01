<!--
    Aerobic efficiency over the last twelve weeks.

    Efficiency factor is how much grade-adjusted pace you get per heartbeat, so
    a line that climbs means the same effort is buying more speed — the clearest
    read on whether base fitness is genuinely improving, rather than whether last
    week happened to be cool and flat. The headline percentage uses that same
    window, and the line is a 14-day average of the runs in it.

    Only aerobic runs are plotted (the engine drops anything at or above zone 4),
    because EF rises with intensity by construction and leaving intervals in
    would draw the week's workout schedule instead of a trend. Tempo still
    counts: it is below lactate threshold.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import ChartFrame from "../charts/ChartFrame.svelte";
    import { axisTicks, CHART_WEEKS, niceScale, seriesPoints, smoothPath, withinWindow, xPct, yPct } from "../lib/chart.js";
    import { axisDate, shortDate } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { efficiency = null, summary = null, today = null } = $props();

    const WIDTH = 720;
    const HEIGHT = 150;

    const points = $derived(withinWindow(efficiency?.points || [], today));
    const trend = $derived(withinWindow(efficiency?.trend || [], today));
    const stats = $derived(summary?.efficiency || null);
    const decoupling = $derived(summary?.longRun || null);

    // Both series share one domain so the smoothed line sits among the runs it
    // was averaged from rather than on its own scale. EF lives in a narrow band
    // around 1.3, so the axis is not anchored to zero — that would compress a
    // block's worth of progress into a flat line across the top.
    const scale = $derived(
        niceScale(
            [
                Math.min(...[...points, ...trend].map((p) => p.ef)),
                Math.max(...[...points, ...trend].map((p) => p.ef)),
            ],
            3,
        ),
    );
    const domain = $derived([scale.min, scale.max]);
    const yTicks = $derived(axisTicks(scale, (v) => v.toFixed(scale.step < 0.1 ? 2 : 1)));

    const dots = $derived(seriesPoints(points.map((p) => p.ef), { width: WIDTH, height: HEIGHT, domain }));
    const line = $derived(seriesPoints(trend.map((p) => p.ef), { width: WIDTH, height: HEIGHT, domain }));

    const xTicks = $derived.by(() => {
        if (points.length < 2) return [];
        const middle = points[Math.floor(points.length / 2)];
        return [
            { key: "first", label: axisDate(points[0].date), pct: 0, anchor: "start" },
            { key: "mid", label: axisDate(middle.date), pct: 50, anchor: "middle" },
            { key: "last", label: axisDate(points.at(-1).date), pct: 100, anchor: "end" },
        ];
    });

    const change = $derived(Number.isFinite(stats?.changePct) ? stats.changePct : null);

    // Every dot is one run, and the trend is a 14-day mean of the same list,
    // so the two share an index and a cursor can honestly show both: what that
    // run measured, and where the last two weeks stood by then. Three decimals
    // because EF moves in the third one — 1.32 to 1.34 is a block's worth of
    // progress.
    const scrub = $derived(
        points.map((point, i) => ({
            key: `${point.date}-${i}`,
            pct: xPct(dots[i].x, WIDTH),
            label: shortDate(point.date),
            readouts: [
                {
                    label: "This run",
                    value: point.ef.toFixed(3),
                    colour: "var(--paragraph-colour)",
                    yPct: yPct(dots[i].y, HEIGHT),
                },
                {
                    label: "Trend",
                    value: trend[i].ef.toFixed(3),
                    colour: "var(--main-green)",
                    yPct: yPct(line[i].y, HEIGHT),
                },
            ],
        })),
    );
</script>

<Card title="Aerobic efficiency" info={GLOSSARY.efficiency}>
    {#snippet aside()}
        {#if change !== null}
            <p class="readout" class:up={change > 0} class:down={change < 0}>
                {change > 0 ? "+" : ""}{change.toFixed(1)}% over {CHART_WEEKS} weeks
            </p>
        {/if}
    {/snippet}

    {#if points.length < 2}
        <p class="card-empty">Not enough aerobic runs with heart rate in the last {CHART_WEEKS} weeks to plot yet.</p>
    {:else}
        <ChartFrame height={160} {yTicks} {xTicks} {scrub} label="Efficiency factor per aerobic run over the last {CHART_WEEKS} weeks">
            <svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none">
                {#each dots as dot}
                    <circle class="dot" cx={dot.x} cy={dot.y} r="3" />
                {/each}
                <path class="line" d={smoothPath(line)} />
            </svg>
        </ChartFrame>
        <p class="chart-unit">speed per heartbeat · {points.length} aerobic runs in the last {CHART_WEEKS} weeks</p>

        <p class="note">
            {#if change !== null && change > 1}
                Speed per heartbeat is rising — the aerobic base is building.
            {:else if change !== null && change < -1}
                Speed per heartbeat is falling. Fatigue, heat, or too much hard running will all do this.
            {:else}
                Speed per heartbeat is holding steady.
            {/if}
            {#if Number.isFinite(decoupling?.decouplingPct)}
                Your last long run drifted {decoupling.decouplingPct.toFixed(1)}% from first half to second{decoupling.decouplingPct < 5 ? ", inside the 5% marker for being aerobically ready for the distance" : " — above the 5% marker, which usually means the distance is still ahead of the base"}.
            {/if}
        </p>
    {/if}
</Card>

<style>
    .readout {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.75;
        margin: 0;
    }
    .readout.up { color: var(--tone-good); opacity: 1; }
    .readout.down { color: var(--tone-bad); opacity: 1; }

    .dot {
        fill: var(--paragraph-colour);
        opacity: 0.3;
        vector-effect: non-scaling-stroke;
    }
    .line {
        fill: none;
        stroke: var(--main-green);
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
    }

    .note {
        margin: var(--space-3) 0 0;
        font-size: var(--font-xs);
        line-height: 1.6;
        color: var(--paragraph-colour);
        opacity: 0.75;
        max-width: 70ch;
    }
</style>
