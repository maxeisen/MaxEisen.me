<!--
    Weekly volume against the plan.

    Bars are what was actually run; the tick above each is the planned target,
    where one has been entered. Weeks with no plan entry simply have no tick,
    rather than reading as a target of zero.

    The window stops at the current week rather than running on to race day.
    Charting the weeks still to come stretched the axis across four months and
    squeezed the training that has actually happened into the left half — and
    what's planned ahead is already spelled out, week by week, further down the
    page.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import ChartFrame from "../charts/ChartFrame.svelte";
    import { axisTicks, bars, CHART_WEEKS, niceScale } from "../lib/chart.js";
    import { axisDate, weekRange } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { weeks = [], today = null } = $props();

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

<Card title="Weekly volume" info={GLOSSARY.volume}>
    {#snippet aside()}
        <p class="legend">
            <span class="swatch actual"></span> run
            <span class="swatch planned"></span> planned
            <span class="window">last {CHART_WEEKS} weeks</span>
        </p>
    {/snippet}

    {#if shown.length === 0}
        <p class="card-empty">No weeks recorded yet.</p>
    {:else}
        <ChartFrame height={190} {yTicks} {xTicks} label="Weekly running volume in kilometres against plan">
            <svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none">
                {#each layout as bar, i}
                    {@const week = shown[i]}
                    <rect
                        class="bar"
                        class:taper={week.isTaper}
                        x={bar.x}
                        y={bar.y}
                        width={bar.width}
                        height={bar.height}
                        rx="2"
                    >
                        <title>{weekRange(week.start)} — {bar.value.toFixed(1)} km{week.targetKm ? ` of ${week.targetKm} km planned` : ""}</title>
                    </rect>
                    {#if targets[i]}
                        <line
                            class="target"
                            x1={targets[i].x - 2}
                            x2={targets[i].x + targets[i].width + 2}
                            y1={targets[i].y}
                            y2={targets[i].y}
                        />
                    {/if}
                {/each}
            </svg>
        </ChartFrame>
        <p class="chart-unit">kilometres per week</p>
    {/if}
</Card>

<style>
    .legend {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin: 0;
        flex-wrap: wrap;
    }
    .swatch {
        display: inline-block;
        width: 12px;
        height: 8px;
        border-radius: 2px;
    }
    .swatch.actual { background: var(--main-green); }
    .swatch.planned {
        height: 2px;
        background: var(--paragraph-colour);
        opacity: 0.6;
    }
    .window {
        padding-left: var(--space-2);
        border-left: 1px solid var(--main-green-translucent);
        opacity: 0.85;
    }

    .bar {
        fill: var(--main-green);
        opacity: 0.75;
        transition: opacity 0.15s ease;
    }
    .bar:hover { opacity: 1; }
    /* Taper weeks are meant to be small — mark them so a short bar late in
       the block doesn't read as a missed week. */
    .bar.taper {
        fill: var(--background-accent);
        opacity: 0.9;
    }
    .target {
        stroke: var(--paragraph-colour);
        stroke-width: 2;
        opacity: 0.55;
        stroke-linecap: round;
    }

</style>
