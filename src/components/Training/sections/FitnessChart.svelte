<!--
    Fitness, fatigue and form over the block.

    Fitness is the slow 42-day trace and fatigue the fast 7-day one; the gap
    between them is form. Fatigue above fitness means you're in the work; the
    lines crossing back the other way is what a taper is supposed to produce.
-->
<script>
    import { areaPath, extent, linePath, seriesPoints } from "../lib/chart.js";
    import { axisDate } from "../lib/format.js";

    let { series = [] } = $props();

    const WIDTH = 720;
    const HEIGHT = 200;

    // One point per day is more resolution than the chart can show; sample
    // down so the path stays light without changing its shape.
    const sampled = $derived.by(() => {
        if (series.length <= 180) return series;
        const step = Math.ceil(series.length / 180);
        return series.filter((_, i) => i % step === 0 || i === series.length - 1);
    });

    const domain = $derived(
        extent([
            ...sampled.map((d) => d.ctl),
            ...sampled.map((d) => d.atl),
            ...sampled.map((d) => d.tsb),
        ]),
    );

    const ctlPoints = $derived(seriesPoints(sampled.map((d) => d.ctl), { width: WIDTH, height: HEIGHT, domain }));
    const atlPoints = $derived(seriesPoints(sampled.map((d) => d.atl), { width: WIDTH, height: HEIGHT, domain }));
    const tsbPoints = $derived(seriesPoints(sampled.map((d) => d.tsb), { width: WIDTH, height: HEIGHT, domain }));

    // Where zero sits, so negative form reads correctly against the baseline.
    const zeroY = $derived.by(() => {
        const [min, max] = domain;
        if (max === min) return HEIGHT;
        return HEIGHT - ((0 - min) / (max - min)) * HEIGHT;
    });

    const latest = $derived(series.at(-1) || null);
</script>

<section class="card">
    <div class="card-head">
        <h2>Fitness and fatigue</h2>
        {#if latest}
            <p class="readout">
                <span class="key fitness">Fitness {Math.round(latest.ctl)}</span>
                <span class="key fatigue">Fatigue {Math.round(latest.atl)}</span>
                <span class="key form">Form {latest.tsb > 0 ? "+" : ""}{Math.round(latest.tsb)}</span>
            </p>
        {/if}
    </div>

    {#if sampled.length < 2}
        <p class="empty">Not enough history to plot yet.</p>
    {:else}
        <svg class="chart" viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none" role="img" aria-label="Fitness, fatigue and form over time">
            <line class="zero" x1="0" x2={WIDTH} y1={zeroY} y2={zeroY} />
            <path class="area" d={areaPath(ctlPoints, HEIGHT)} />
            <path class="line form" d={linePath(tsbPoints)} />
            <path class="line fatigue" d={linePath(atlPoints)} />
            <path class="line fitness" d={linePath(ctlPoints)} />
        </svg>

        <div class="axis">
            <span>{axisDate(sampled[0].date)}</span>
            <span>{axisDate(sampled.at(-1).date)}</span>
        </div>
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
        display: flex;
        gap: var(--space-4);
        flex-wrap: wrap;
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin: 0;
    }
    .key { color: var(--paragraph-colour); opacity: 0.75; }
    .key.fitness { color: var(--main-green); opacity: 1; }
    .key.fatigue { color: var(--color-error-soft); }

    .chart {
        width: 100%;
        height: 210px;
        display: block;
    }
    .zero {
        stroke: var(--paragraph-colour);
        stroke-width: 1;
        opacity: 0.2;
        stroke-dasharray: 4 4;
        vector-effect: non-scaling-stroke;
    }
    .area {
        fill: var(--main-green);
        opacity: 0.12;
    }
    .line {
        fill: none;
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
    }
    .line.fitness { stroke: var(--main-green); }
    .line.fatigue { stroke: var(--color-error-soft); opacity: 0.8; }
    .line.form {
        stroke: var(--paragraph-colour);
        opacity: 0.4;
        stroke-dasharray: 3 3;
    }

    .axis {
        display: flex;
        justify-content: space-between;
        margin-top: var(--space-2);
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.6;
    }
    .empty {
        font-size: var(--font-sm);
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin: 0;
    }
</style>
