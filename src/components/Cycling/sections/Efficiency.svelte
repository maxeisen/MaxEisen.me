<!-- Watts per heartbeat on metered aerobic rides. Not the running pace chart. -->
<script>
    import Card from "../../Activity/Card.svelte";
    import ChartFrame from "../../Activity/charts/ChartFrame.svelte";
    import { axisTicks, dateRangeTicks, niceScale, seriesPoints, smoothPath, withinWindow, xPct, yPct } from "../../Activity/lib/chart.js";
    import { axisDate } from "../../Activity/lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { efficiency = null, today = null, info = GLOSSARY.efficiency } = $props();

    const WIDTH = 720;
    const HEIGHT = 150;

    const points = $derived(withinWindow(efficiency?.points || [], today));
    const trend = $derived(withinWindow(efficiency?.trend || [], today));
    const values = $derived([...points, ...trend].map((p) => p.ef).filter((n) => n > 0));
    const scale = $derived(values.length ? niceScale([Math.min(...values), Math.max(...values)], 3) : null);
    const domain = $derived(scale ? [scale.min, scale.max] : [0, 1]);
    const yTicks = $derived(scale ? axisTicks(scale, (v) => v.toFixed(2)) : []);
    const dots = $derived(seriesPoints(points.map((p) => p.ef), { width: WIDTH, height: HEIGHT, domain }));
    const line = $derived(seriesPoints(trend.map((p) => p.ef), { width: WIDTH, height: HEIGHT, domain }));
    const xTicks = $derived(dateRangeTicks(points, axisDate));
    const path = $derived(smoothPath(line));
    const scrub = $derived(
        dots.map((dot, i) => ({
            key: points[i]?.date,
            pct: xPct(dot.x, WIDTH),
            label: axisDate(points[i]?.date),
            readouts: [{ label: "W/bpm", value: points[i]?.ef?.toFixed(2) ?? "—", colour: "var(--main-green)", yPct: yPct(dot.y, HEIGHT) }],
        })),
    );
</script>

<Card title="Aerobic efficiency" {info}>
    {#if points.length === 0}
        <p class="card-empty">No metered aerobic rides yet.</p>
    {:else}
        <ChartFrame height={160} {yTicks} {xTicks} {scrub} label="Watts per heartbeat on metered aerobic rides">
            <svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none">
                {#if path}<path class="trend" d={path} />{/if}
                {#each dots as dot, i (points[i].date)}
                    <circle class="dot" cx={dot.x} cy={dot.y} r="3" />
                {/each}
            </svg>
        </ChartFrame>
        <p class="unit">watts per heartbeat</p>
    {/if}
</Card>

<style>
    .trend { fill: none; stroke: var(--main-green); stroke-width: 2; }
    .dot { fill: var(--main-green); }
    .unit {
        margin: var(--space-2) 0 0;
        font-size: var(--font-2xs);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--paragraph-colour);
        opacity: 0.6;
    }
</style>
