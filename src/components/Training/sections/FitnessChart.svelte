<!--
    Fitness, fatigue and form over the block.

    Fitness is the slow 42-day trace and fatigue the fast 7-day one; the gap
    between them is form. Fatigue above fitness means you're in the work; the
    lines crossing back the other way is what a taper is supposed to produce.

    The series carries the whole run-up — months of it, deliberately, so the
    42-day average is warm by the time the block starts — but only the same
    trailing window as the other charts is drawn, so the three can be read
    against each other.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import ChartFrame from "../charts/ChartFrame.svelte";
    import { areaPath, axisTicks, CHART_WEEKS, niceScale, seriesPoints, smoothPath, withinWindow, xPct, yPct } from "../lib/chart.js";
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

    const scale = $derived(
        niceScale(
            [
                Math.min(0, ...sampled.map((d) => Math.min(d.ctl, d.atl, d.tsb))),
                Math.max(1, ...sampled.map((d) => Math.max(d.ctl, d.atl, d.tsb))),
            ],
            4,
        ),
    );
    const domain = $derived([scale.min, scale.max]);
    const yTicks = $derived(axisTicks(scale, (v) => String(Math.round(v))));

    // The fitness area is filled down to zero, not to the floor of the chart:
    // the axis dips below zero to make room for negative form, and shading
    // that band would claim fitness the athlete doesn't have.
    const zeroY = $derived(HEIGHT - ((0 - scale.min) / (scale.max - scale.min)) * HEIGHT);

    const ctlPoints = $derived(seriesPoints(sampled.map((d) => d.ctl), { width: WIDTH, height: HEIGHT, domain }));
    const atlPoints = $derived(seriesPoints(sampled.map((d) => d.atl), { width: WIDTH, height: HEIGHT, domain }));
    const tsbPoints = $derived(seriesPoints(sampled.map((d) => d.tsb), { width: WIDTH, height: HEIGHT, domain }));

    const xTicks = $derived.by(() => {
        if (sampled.length < 2) return [];
        const middle = sampled[Math.floor(sampled.length / 2)];
        return [
            { key: "first", label: axisDate(sampled[0].date), pct: 0, anchor: "start" },
            { key: "mid", label: axisDate(middle.date), pct: 50, anchor: "middle" },
            { key: "last", label: axisDate(sampled.at(-1).date), pct: 100, anchor: "end" },
        ];
    });

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
        <ChartFrame height={210} {yTicks} {xTicks} {scrub} label="Fitness, fatigue and form over the last {CHART_WEEKS} weeks">
            <svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none">
                <path class="fatigue-fill" d={areaPath(atlPoints, zeroY, { smooth: true })} />
                <path class="fitness-fill" d={areaPath(ctlPoints, zeroY, { smooth: true })} />
                <path class="line form" d={smoothPath(tsbPoints)} />
                <path class="line fatigue" d={smoothPath(atlPoints)} />
                <path class="line fitness" d={smoothPath(ctlPoints)} />
            </svg>
        </ChartFrame>
        <p class="chart-unit">training load · last {CHART_WEEKS} weeks</p>
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
    /* Fatigue filled rather than left as a bare line. A 7-day average of an
       athlete who runs every second day genuinely sawtooths, and there is no
       honest way to remove that; what can be removed is its loudness. Given a
       body, the same wobble reads as a range of hills instead of a bright red
       zigzag, and the sentence this chart exists to show — fatigue standing
       above fitness means you're in the work — becomes a thing you can see
       rather than a comparison you have to make. */
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
    /* A hierarchy rather than three equal lines. Fitness is the one the chart
       is about and the only one that moves slowly enough to have a shape, so
       it's drawn heaviest; fatigue and form both oscillate with every session
       and, at matching weight, the eye reads the noise instead of the trend. */
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
