<!-- Fitness, fatigue and form over the trailing window. -->
<script>
    import Card from "../Card.svelte";
    import ChartFrame from "../charts/ChartFrame.svelte";
    import { areaPath, axisTicks, CHART_WEEKS, dateRangeTicks, niceScale, seriesPoints, smoothPath, withinWindow, xPct, yPct } from "../lib/chart.js";
    import { axisDate, shortDate, signed } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { series = [], today = null } = $props();

    const WIDTH = 720;
    const HEIGHT = 200;

    const windowed = $derived(withinWindow(series, today || series.at(-1)?.date));

    // One point per day is more resolution than the chart can show; sample
    // down so the path stays light without changing its shape.
    const sampled = $derived.by(() => {
        if (windowed.length <= 180) return windowed;
        const step = Math.ceil(windowed.length / 180);
        return windowed.filter((_, i) => i % step === 0 || i === windowed.length - 1);
    });

    // Form and fatigue swing well past the slow fitness line, and that shared
    // range was flattening a steady build into a short segment. Pin them to
    // the −50…+100 axis they already read on, and widen it only if a day runs
    // past either end. Fitness takes the right-hand scale, fitted to itself.
    const FORM_FLOOR = -50;
    const FORM_CEILING = 100;

    const formScale = $derived(
        niceScale(
            [
                Math.min(FORM_FLOOR, ...sampled.map((d) => Math.min(d.atl, d.tsb))),
                Math.max(FORM_CEILING, ...sampled.map((d) => Math.max(d.atl, d.tsb))),
            ],
            4,
        ),
    );
    const formDomain = $derived([formScale.min, formScale.max]);
    const yTicks = $derived(axisTicks(formScale, (v) => String(Math.round(v))));

    const fitnessScale = $derived.by(() => {
        const values = sampled.map((d) => d.ctl).filter((v) => Number.isFinite(v));
        if (values.length === 0) return niceScale([0, 1], 4);
        return niceScale([Math.min(...values), Math.max(...values)], 4);
    });
    const fitnessDomain = $derived([fitnessScale.min, fitnessScale.max]);
    const rightTicks = $derived(
        axisTicks(fitnessScale, (v) => String(Math.round(v))).map((tick) => ({
            ...tick,
            colour: "var(--main-green)",
        })),
    );

    // Fatigue fills down to zero on the left axis. Fitness fills to its own
    // floor: that scale starts above zero, and shading down through zero
    // would run off the bottom of the plot.
    const zeroY = $derived(
        formScale.max > formScale.min
            ? HEIGHT - ((0 - formScale.min) / (formScale.max - formScale.min)) * HEIGHT
            : HEIGHT,
    );

    const ctlPoints = $derived(seriesPoints(sampled.map((d) => d.ctl), { width: WIDTH, height: HEIGHT, domain: fitnessDomain }));
    const atlPoints = $derived(seriesPoints(sampled.map((d) => d.atl), { width: WIDTH, height: HEIGHT, domain: formDomain }));
    const tsbPoints = $derived(seriesPoints(sampled.map((d) => d.tsb), { width: WIDTH, height: HEIGHT, domain: formDomain }));

    const xTicks = $derived(dateRangeTicks(sampled, axisDate));

    const latest = $derived(series.at(-1) || null);

    // Form is the gap between the other two, so all three want reading at the
    // same instant — which is the whole reason this chart is worth scrubbing
    // rather than just labelling its ends.
    const scrub = $derived(
        sampled.map((day, i) => ({
            key: day.date,
            pct: xPct(ctlPoints[i].x, WIDTH),
            label: shortDate(day.date),
            readouts: [
                {
                    label: "Fitness",
                    value: String(Math.round(day.ctl)),
                    colour: "var(--main-green)",
                    yPct: yPct(ctlPoints[i].y, HEIGHT),
                },
                {
                    label: "Fatigue",
                    value: String(Math.round(day.atl)),
                    colour: "var(--tone-bad)",
                    yPct: yPct(atlPoints[i].y, HEIGHT),
                },
                {
                    label: "Form",
                    value: signed(day.tsb, 0),
                    colour: "var(--paragraph-colour)",
                    yPct: yPct(tsbPoints[i].y, HEIGHT),
                },
            ],
        })),
    );
</script>

<Card title="Fitness and fatigue" info={GLOSSARY.fitness}>
    {#snippet aside()}
        {#if latest}
            <p class="readout">
                <span class="key fitness">Fitness {Math.round(latest.ctl)}</span>
                <span class="key fatigue">Fatigue {Math.round(latest.atl)}</span>
                <span class="key form">Form {latest.tsb > 0 ? "+" : ""}{Math.round(latest.tsb)}</span>
            </p>
        {/if}
    {/snippet}

    {#if sampled.length < 2}
        <p class="card-empty">Not enough history to plot yet.</p>
    {:else}
        <ChartFrame height={210} {yTicks} {rightTicks} {xTicks} {scrub} label="Fitness on its own scale, with fatigue and form, over the last {CHART_WEEKS} weeks">
            <svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none">
                <path class="fatigue-fill" d={areaPath(atlPoints, zeroY, { smooth: true })} />
                <path class="fitness-fill" d={areaPath(ctlPoints, HEIGHT, { smooth: true })} />
                <path class="line form" d={smoothPath(tsbPoints)} />
                <path class="line fatigue" d={smoothPath(atlPoints)} />
                <path class="line fitness" d={smoothPath(ctlPoints)} />
            </svg>
        </ChartFrame>
        <p class="chart-unit">fitness, right · form and fatigue, left · last {CHART_WEEKS} weeks</p>
    {/if}
</Card>

<style>
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
    .key.fatigue { color: var(--tone-bad); }

    .fitness-fill {
        fill: var(--main-green);
        opacity: 0.12;
    }
    /* Fill fatigue so the 7-day sawtooth reads as hills, not a zigzag. */
    .fatigue-fill {
        fill: var(--tone-bad);
        opacity: 0.14;
    }
    .line {
        fill: none;
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
    }
    /* Fitness is the slow line; fatigue and form oscillate with every session. */
    .line.fitness {
        stroke: var(--main-green);
        stroke-width: 2.25;
    }
    .line.fatigue {
        stroke: var(--tone-bad);
        stroke-width: 1.25;
        opacity: 0.55;
    }
    .line.form {
        stroke: var(--paragraph-colour);
        stroke-width: 1.25;
        opacity: 0.35;
        stroke-dasharray: 3 3;
    }

</style>
