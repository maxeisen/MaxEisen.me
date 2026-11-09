<!--
    Pace (faster-is-higher) and heart rate across one run. HR is a quieter
    band underneath so the two scales don't read as equal when they cross.
-->
<script>
    import ChartLegend from "../../Activity/charts/ChartLegend.svelte";
    import Dots from "../../Activity/charts/Dots.svelte";
    import ChartFrame from "../../Activity/charts/ChartFrame.svelte";
    import { areaPath, contiguous, linePath, niceScale, scaleLinear, smoothPath, xPct, yPct } from "../../Activity/lib/chart.js";
    import { pace } from "../../Activity/lib/format.js";

    let { run = null } = $props();

    const WIDTH = 720;
    const HEIGHT = 150;
    const GAP_DIVERGENCE_SEC = 4;
    const PACE_STEPS = [15, 30, 60, 120, 300];

    const splits = $derived((run?.splits || []).filter((s) => s.paceSecPerKm > 0));
    const traced = $derived(Array.isArray(run?.trace?.m) && run.trace.m.length > 1);

    const samples = $derived.by(() => {
        if (traced) {
            const { m, pace: paces, hr } = run.trace;
            return m.map((metres, i) => ({
                m: metres,
                paceSecPerKm: paces[i] > 0 ? paces[i] : null,
                hr: hr[i] > 0 ? hr[i] : null,
            }));
        }
        return splits.map((s) => ({
            m: (s.km - 0.5) * 1000,
            paceSecPerKm: s.paceSecPerKm,
            hr: s.averageHr > 0 ? s.averageHr : null,
        }));
    });

    const span = $derived(Math.max(run?.distanceM || 0, samples.at(-1)?.m || 0));
    const atX = $derived((metres) => (span > 0 ? (metres / span) * WIDTH : 0));

    const paces = $derived(samples.map((s) => s.paceSecPerKm).filter((p) => p > 0));
    const scale = $derived(
        niceScale([Math.min(...paces) - 8, Math.max(...paces) + 8], 4, { steps: PACE_STEPS }),
    );
    const y = $derived(scaleLinear([scale.min, scale.max], [0, HEIGHT]));
    const yTicks = $derived(
        scale.ticks.map((value) => ({
            value,
            label: pace(value).replace("/km", ""),
            pct: 100 - ((value - scale.min) / (scale.max - scale.min)) * 100,
        })),
    );

    const paceLines = $derived(
        contiguous(samples.map((s) => (s.paceSecPerKm > 0 ? { x: atX(s.m), y: y(s.paceSecPerKm) } : null))),
    );

    const gapPoints = $derived(
        !traced && splits.length > 1 && splits.every((s) => s.gapPaceSecPerKm > 0)
            ? splits.map((s) => ({ x: atX((s.km - 0.5) * 1000), y: y(s.gapPaceSecPerKm) }))
            : [],
    );
    const showGap = $derived(
        gapPoints.length > 0
            && splits.some((s) => Math.abs(s.gapPaceSecPerKm - s.paceSecPerKm) >= GAP_DIVERGENCE_SEC),
    );

    const averageY = $derived(run?.paceSecPerKm > 0 ? y(run.paceSecPerKm) : null);

    const beats = $derived(samples.map((s) => s.hr).filter((b) => b > 0));
    const hasHr = $derived(beats.length > 1);

    const hrScale = $derived.by(() => {
        if (!hasHr) return null;
        return niceScale([Math.min(...beats) - 4, Math.max(...beats) + 4], 4);
    });
    const hrY = $derived(hrScale ? scaleLinear([hrScale.min, hrScale.max], [HEIGHT, 0]) : null);
    const hrLines = $derived(
        hrScale
            ? contiguous(samples.map((s) => (s.hr > 0 ? { x: atX(s.m), y: hrY(s.hr) } : null)))
            : [],
    );
    const hrTicks = $derived(
        hrScale
            ? hrScale.ticks.map((value) => ({
                    value,
                    label: String(Math.round(value)),
                    pct: ((value - hrScale.min) / (hrScale.max - hrScale.min)) * 100,
                }))
            : [],
    );

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
            .map((sample, i) => ({ sample, i }))
            .filter(({ sample }) => sample.paceSecPerKm > 0 || sample.hr > 0)
            .map(({ sample, i }) => ({
                key: sample.m,
                pct: xPct(atX(sample.m), WIDTH),
                label: traced ? `${(sample.m / 1000).toFixed(2)} km` : `Kilometre ${splits[i].km}`,
                readouts: [
                    ...(sample.paceSecPerKm > 0
                        ? [{
                            label: "Pace",
                            value: pace(sample.paceSecPerKm),
                            colour: "var(--series-1)",
                            yPct: yPct(y(sample.paceSecPerKm), HEIGHT),
                        }]
                        : []),
                    ...(showGap && splits[i]?.gapPaceSecPerKm > 0
                        ? [{
                            label: "Grade adjusted",
                            value: pace(splits[i].gapPaceSecPerKm),
                            colour: "var(--series-3)",
                            yPct: yPct(y(splits[i].gapPaceSecPerKm), HEIGHT),
                        }]
                        : []),
                    ...(sample.hr > 0
                        ? [{
                            label: "Heart rate",
                            value: `${Math.round(sample.hr)} bpm`,
                            colour: "var(--series-2)",
                            yPct: hrY ? yPct(hrY(sample.hr), HEIGHT) : undefined,
                        }]
                        : []),
                ],
            })),
    );

    const steady = $derived(run?.effort !== "hard");
    const fade = $derived(run?.pacing?.fadePct ?? null);
    const pacingNote = $derived(fade === null ? null : (steady ? heldOrFaded(fade) : halves(fade)));

    function heldOrFaded(pct) {
        if (pct <= -2) return "negative split — the second half was quicker";
        if (pct < 2) return "even pace, start to finish";
        if (pct < 5) return `faded ${pct.toFixed(1)}% over the second half`;
        return `faded ${pct.toFixed(1)}% — the second half cost you`;
    }

    function halves(pct) {
        if (Math.abs(pct) < 2) return "even halves";
        const direction = pct > 0 ? "slower" : "quicker";
        return `second half ${Math.abs(pct).toFixed(1)}% ${direction}`;
    }

    const visible = $derived(paceLines.length || hrLines.length);
</script>

{#if visible}
    <div class="chart">
        <ChartFrame
            height={HEIGHT}
            {yTicks}
            {xTicks}
            {scrub}
            rightTicks={hrTicks}
            label="Pace{hasHr ? ' and heart rate' : ''} across the run"
        >
            <svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none">
                {#each hrLines as line, i (i)}
                    <path class="hr-fill" d={areaPath(line, HEIGHT, { smooth: true })} />
                    <path class="hr" d={smoothPath(line)} />
                {/each}
                {#if averageY !== null}
                    <line class="average" x1="0" x2={WIDTH} y1={averageY} y2={averageY} />
                {/if}
                {#if showGap}
                    <path class="gap" d={linePath(gapPoints)} />
                {/if}
                {#each paceLines as line, i (i)}
                    <path class="line" d={smoothPath(line)} />
                {/each}
            </svg>
            {#if !traced}
                <Dots points={paceLines.flat()} width={WIDTH} height={HEIGHT} size={8} color="var(--series-1)" />
            {/if}
        </ChartFrame>
        <ChartLegend
            under
            items={[
                { label: "Pace per km, faster is higher", color: "var(--series-1)" },
                ...(showGap ? [{ label: "Grade adjusted", color: "var(--series-3)", mark: "dash" }] : []),
                ...(hasHr ? [{ label: "Heart rate, right scale", color: "var(--series-2)" }] : []),
            ]}
            note={pacingNote || null}
        />
    </div>
{/if}

<style>
    .chart { margin-top: var(--space-5); }
    .line {
        fill: none;
        stroke: var(--series-1);
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
    }
    .gap {
        fill: none;
        stroke: var(--series-3);
        stroke-width: 1.5;
        stroke-dasharray: 4 4;
        vector-effect: non-scaling-stroke;
    }
    .hr {
        fill: none;
        stroke: var(--series-2);
        stroke-width: 1.5;
        vector-effect: non-scaling-stroke;
    }
    .hr-fill { fill: var(--series-2); opacity: 0.1; }
    .average {
        stroke: var(--text-3);
        stroke-width: 1;
        stroke-dasharray: 2 4;
        vector-effect: non-scaling-stroke;
    }
</style>
