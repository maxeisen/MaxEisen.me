<!-- Weekly volume against the plan. Bars are what was run; ticks are targets. -->
<script>
    import ChartLegend from "../charts/ChartLegend.svelte";
    import Card from "../../../lib/ui/Card.svelte";
    import ChartFrame from "../charts/ChartFrame.svelte";
    import Bars from "../charts/Bars.svelte";
    import { axisTicks, bars, CHART_WEEKS, niceScale, xPct, yPct } from "../lib/chart.js";
    import { axisDate, weekCaption } from "../lib/format.js";
    import { GLOSSARY } from "../../Training/lib/glossary.js";

    let { weeks = [], today = null, info = GLOSSARY.volume, distanceLabel = "Run", chartLabel = null } = $props();

    const WIDTH = 720;
    const HEIGHT = 180;

    const shown = $derived(
        weeks.filter((w) => !today || w.start <= today).slice(-CHART_WEEKS),
    );

    // Round the ceiling up to the axis's top gridline so the tallest bar ends
    // at a labelled number rather than somewhere between two of them.
    const scale = $derived(
        niceScale(
            [0, Math.max(10, ...shown.map((w) => Math.max(w.actualKm || 0, w.targetKm || 0)))],
            4,
        ),
    );
    const yTicks = $derived(axisTicks(scale, (v) => String(Math.round(v))));

    const layout = $derived(
        bars(shown.map((w) => w.actualKm || 0), { width: WIDTH, height: HEIGHT, max: scale.max }),
    );
    const targets = $derived(
        shown.map((week, i) => {
            const slot = layout[i];
            if (!slot || !(week.targetKm > 0)) return null;
            return { ...slot, y: HEIGHT - (week.targetKm / scale.max) * HEIGHT };
        }),
    );

    // Between blocks there's nothing to plan against, and a legend entry for
    // ticks that aren't drawn is noise.
    const hasTargets = $derived(targets.some(Boolean));
    const hasTaper = $derived(shown.some((w) => w.isTaper));

    // Run against planned, week by week. The bar and its tick are the two
    // numbers the chart is a comparison of, so both belong in the readout —
    // and a taper week says so, since a short bar there is the plan working.
    const scrub = $derived(
        shown.map((week, i) => ({
            key: week.start,
            pct: xPct(layout[i].x + layout[i].width / 2, WIDTH),
            label: weekCaption(week),
            readouts: [
                {
                    label: week.isTaper ? `${distanceLabel} (taper)` : distanceLabel,
                    value: `${(week.actualKm || 0).toFixed(1)} km`,
                    colour: week.isTaper ? "var(--series-3)" : "var(--series-1)",
                    yPct: yPct(layout[i].y, HEIGHT),
                },
                ...(week.targetKm > 0
                    ? [
                            {
                                label: "Planned",
                                value: `${week.targetKm} km`,
                                colour: "var(--text-strong)",
                                yPct: yPct(targets[i].y, HEIGHT),
                            },
                        ]
                    : []),
            ],
        })),
    );

    // A date under every bar doesn't fit on a phone, so label every third week
    // plus both ends — dropping any stepped label that would crowd the last
    // one, which on a phone means two dates overlapping.
    const xTicks = $derived(
        shown
            .map((week, i) => ({ week, i }))
            .filter(({ i }) => {
                const last = shown.length - 1;
                if (i === 0 || i === last) return true;
                return i % 3 === 0 && last - i >= 3;
            })
            .map(({ week, i }) => ({
                key: week.start,
                label: axisDate(week.start),
                pct: ((i + 0.5) / shown.length) * 100,
                anchor: i === 0 ? "start" : i === shown.length - 1 ? "end" : "middle",
            })),
    );
</script>

<Card title="Weekly volume" {info}>
    {#snippet aside()}
        <ChartLegend
            items={[
                { label: distanceLabel, color: "var(--series-1)", mark: "box" },
                ...(hasTaper ? [{ label: "Taper", color: "var(--series-3)", mark: "box" }] : []),
                ...(hasTargets ? [{ label: "Planned", color: "var(--text-strong)" }] : []),
            ]}
            note="Last {CHART_WEEKS} weeks"
        />
    {/snippet}

    {#if shown.length === 0}
        <p class="card-empty">No weeks recorded yet.</p>
    {:else}
        <ChartFrame height={190} {yTicks} {xTicks} {scrub} label={chartLabel ?? (hasTargets ? "Weekly running volume in kilometres against plan" : "Weekly running volume in kilometres")}>
            <Bars
                {layout}
                width={WIDTH}
                height={HEIGHT}
                colorFor={(i) => (shown[i]?.isTaper ? "var(--series-3)" : null)}
                targets={targets.map((t) => t?.y ?? null)}
            />
        </ChartFrame>
        <p class="chart-unit">Kilometres per week</p>
    {/if}
</Card>

