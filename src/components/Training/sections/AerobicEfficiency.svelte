<!--
    Aerobic efficiency across the block.

    Efficiency factor is how much grade-adjusted pace you get per heartbeat, so
    a line that climbs means the same effort is buying more speed — the clearest
    read on whether base fitness is genuinely improving, rather than whether last
    week happened to be cool and flat.

    Only aerobic runs are plotted (the engine drops anything at or above zone 4),
    because EF rises with intensity by construction and leaving intervals in
    would draw the week's workout schedule instead of a trend.
-->
<script>
    import { extent, linePath, seriesPoints } from "../lib/chart.js";
    import { axisDate } from "../lib/format.js";

    let { efficiency = null, summary = null } = $props();

    const WIDTH = 720;
    const HEIGHT = 150;

    const points = $derived(efficiency?.points || []);
    const trend = $derived(efficiency?.trend || []);
    const stats = $derived(summary?.efficiency || null);
    const decoupling = $derived(summary?.longRun || null);

    // Both series share one domain so the smoothed line sits among the runs it
    // was averaged from rather than on its own scale.
    const domain = $derived(
        extent([...points.map((p) => p.ef), ...trend.map((p) => p.ef)], { includeZero: false }),
    );

    const dots = $derived(seriesPoints(points.map((p) => p.ef), { width: WIDTH, height: HEIGHT, domain }));
    const line = $derived(seriesPoints(trend.map((p) => p.ef), { width: WIDTH, height: HEIGHT, domain }));

    const change = $derived(Number.isFinite(stats?.changePct) ? stats.changePct : null);
</script>

<section class="card">
    <div class="card-head">
        <h2>Aerobic efficiency</h2>
        {#if change !== null}
            <p class="readout" class:up={change > 0} class:down={change < 0}>
                {change > 0 ? "+" : ""}{change.toFixed(1)}% over the block
            </p>
        {/if}
    </div>

    {#if points.length < 2}
        <p class="empty">Not enough aerobic runs with heart rate to plot yet.</p>
    {:else}
        <svg class="chart" viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none" role="img" aria-label="Efficiency factor per run over the training block">
            {#each dots as dot}
                <circle class="dot" cx={dot.x} cy={dot.y} r="3" />
            {/each}
            <path class="line" d={linePath(line)} />
        </svg>

        <div class="axis">
            <span>{axisDate(points[0].date)}</span>
            <span>{points.length} aerobic runs</span>
            <span>{axisDate(points.at(-1).date)}</span>
        </div>

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
</section>

<style>
    .card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
        margin-bottom: var(--space-4);
    }
    h2 {
        font-family: var(--font-serif);
        font-size: var(--font-lg);
        font-weight: 600;
        color: var(--header-colour);
        margin: 0;
    }
    .readout {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.75;
        margin: 0;
    }
    .readout.up { color: var(--main-green); opacity: 1; }
    .readout.down { color: var(--color-error-soft); opacity: 1; }

    .chart {
        width: 100%;
        height: 160px;
        display: block;
    }
    .dot {
        fill: var(--paragraph-colour);
        opacity: 0.28;
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

    .axis {
        display: flex;
        justify-content: space-between;
        margin-top: var(--space-2);
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.6;
    }
    .note {
        margin: var(--space-3) 0 0;
        font-size: var(--font-xs);
        line-height: 1.6;
        color: var(--paragraph-colour);
        opacity: 0.75;
        max-width: 70ch;
    }
    .empty {
        font-size: var(--font-sm);
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin: 0;
    }
</style>
