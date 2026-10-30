<!-- Heart rate, and meter watts, across one ride. Higher is higher. -->
<script>
    import ChartFrame from "../../Activity/charts/ChartFrame.svelte";
    import { areaPath, contiguous, niceScale, scaleLinear, smoothPath, xPct, yPct } from "../../Activity/lib/chart.js";

    let { ride = null } = $props();

    const WIDTH = 720;
    const HEIGHT = 150;

    const trace = $derived(ride?.trace);
    const samples = $derived(
        Array.isArray(trace?.m)
            ? trace.m.map((metres, i) => ({
                    m: metres,
                    hr: trace.hr?.[i] > 0 ? trace.hr[i] : null,
                    watts: trace.watts?.[i] > 0 ? trace.watts[i] : null,
                }))
            : [],
    );

    const hasWatts = $derived(samples.some((s) => s.watts > 0));
    const hasHr = $derived(samples.some((s) => s.hr > 0));
    const span = $derived(Math.max(ride?.distanceM || 0, samples.at(-1)?.m || 0));
    const atX = $derived((metres) => (span > 0 ? (metres / span) * WIDTH : 0));

    function axis(values) {
        const nums = values.filter((v) => v > 0);
        if (nums.length < 2) return null;
        const scale = niceScale([Math.min(...nums) - 4, Math.max(...nums) + 4], 4);
        return {
            scale,
            y: scaleLinear([scale.min, scale.max], [HEIGHT, 0]),
            ticks: scale.ticks.map((value) => ({
                value,
                label: String(Math.round(value)),
                pct: ((value - scale.min) / (scale.max - scale.min)) * 100,
            })),
        };
    }

    const wattsAxis = $derived(hasWatts ? axis(samples.map((s) => s.watts)) : null);
    const hrAxis = $derived(hasHr ? axis(samples.map((s) => s.hr)) : null);
    const left = $derived(wattsAxis || hrAxis);
    const right = $derived(wattsAxis && hrAxis ? hrAxis : null);

    const lines = (pick, placed) =>
        placed
            ? contiguous(samples.map((s) => {
                    const value = pick(s);
                    return value > 0 ? { x: atX(s.m), y: placed.y(value) } : null;
                }))
            : [];

    const wattLines = $derived(lines((s) => s.watts, wattsAxis));
    const hrLines = $derived(lines((s) => s.hr, hrAxis));

    const tickStepKm = $derived(Math.max(1, Math.ceil(span / 1000 / 6)));
    const xTicks = $derived.by(() => {
        const out = [];
        for (let km = 0; km * 1000 <= span; km += tickStepKm) {
            out.push({
                key: km,
                label: String(km),
                pct: span > 0 ? ((km * 1000) / span) * 100 : 0,
                anchor: km === 0 ? "start" : "middle",
            });
        }
        return out;
    });

    const scrub = $derived(
        samples
            .filter((sample) => sample.hr > 0 || sample.watts > 0)
            .map((sample) => ({
                key: sample.m,
                pct: xPct(atX(sample.m), WIDTH),
                label: `${(sample.m / 1000).toFixed(1)} km`,
                readouts: [
                    ...(sample.watts > 0 && wattsAxis
                        ? [{
                                label: "Power",
                                value: `${Math.round(sample.watts)} W`,
                                colour: "var(--main-green)",
                                yPct: yPct(wattsAxis.y(sample.watts), HEIGHT),
                            }]
                        : []),
                    ...(sample.hr > 0 && hrAxis
                        ? [{
                                label: "Heart rate",
                                value: `${Math.round(sample.hr)} bpm`,
                                colour: "var(--tone-bad)",
                                yPct: yPct(hrAxis.y(sample.hr), HEIGHT),
                            }]
                        : []),
                ],
            })),
    );

    const visible = $derived(wattLines.length > 0 || hrLines.length > 0);
    const label = $derived(hasWatts && hasHr ? "Heart rate and power along the ride" : hasWatts ? "Power along the ride" : "Heart rate along the ride");
</script>

{#if visible && left}
    <div class="chart">
        <ChartFrame height={HEIGHT} yTicks={left.ticks} rightTicks={right?.ticks || []} {xTicks} {scrub} {label}>
            <svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none">
                {#each hrLines as line, i (i)}
                    <path class="hr-fill" d={areaPath(line, HEIGHT, { smooth: true })} />
                    <path class="hr" d={smoothPath(line)} />
                {/each}
                {#each wattLines as line, i (i)}
                    <path class="line" d={smoothPath(line)} />
                {/each}
            </svg>
        </ChartFrame>
        <p class="legend">
            <span>kilometre</span>
            {#if hasWatts}<span class="key"><span class="swatch power"></span> watts</span>{/if}
            {#if hasHr}<span class="key"><span class="swatch beats"></span> bpm{hasWatts ? ", right" : ""}</span>{/if}
        </p>
    </div>
{/if}

<style>
    .chart { margin-top: var(--space-5); }
    .line {
        fill: none;
        stroke: var(--main-green);
        stroke-width: 2;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
    }
    .hr {
        fill: none;
        stroke: var(--tone-bad);
        stroke-width: 1.25;
        opacity: 0.55;
        vector-effect: non-scaling-stroke;
    }
    .hr-fill { fill: var(--tone-bad); opacity: 0.12; }
    .legend {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3);
        margin: var(--space-2) 0 0;
        font-size: var(--font-2xs);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--paragraph-colour);
        opacity: 0.7;
    }
    .key { display: inline-flex; align-items: center; gap: 6px; }
    .swatch { width: 14px; height: 2px; background: var(--tone-bad); }
    .swatch.power { background: var(--main-green); }
</style>
