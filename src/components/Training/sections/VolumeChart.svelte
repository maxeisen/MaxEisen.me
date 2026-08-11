<!--
    Weekly volume against the plan.

    Bars are what was actually run; the tick above each is the planned target,
    where one has been entered. Weeks with no plan entry simply have no tick,
    rather than reading as a target of zero.
-->
<script>
    import { bars } from "../lib/chart.js";
    import { axisDate } from "../lib/format.js";

    let { weeks = [], today = null } = $props();

    const WIDTH = 720;
    const HEIGHT = 180;

    // The weekly series runs forward to race day so the plan can be laid over
    // it, but weeks that are both unrun and unplanned carry nothing to draw —
    // charting them squeezes the actual training into the left half behind a
    // stretch of blank space.
    const drawable = $derived(
        weeks.filter((w) => !today || w.start <= today || w.targetKm > 0),
    );
    const shown = $derived(drawable.slice(-16));
    const ceiling = $derived(
        Math.max(
            10,
            ...shown.map((w) => Math.max(w.actualKm || 0, w.targetKm || 0)),
        ) * 1.1,
    );
    const layout = $derived(
        bars(shown.map((w) => w.actualKm || 0), { width: WIDTH, height: HEIGHT, max: ceiling }),
    );
    const targets = $derived(
        shown.map((week, i) => {
            const slot = layout[i];
            if (!slot || !(week.targetKm > 0)) return null;
            return { ...slot, y: HEIGHT - (week.targetKm / ceiling) * HEIGHT, target: week.targetKm };
        }),
    );
</script>

<section class="card">
    <div class="card-head">
        <h2>Weekly volume</h2>
        <p class="legend">
            <span class="swatch actual"></span> run
            <span class="swatch planned"></span> planned
        </p>
    </div>

    {#if shown.length === 0}
        <p class="empty">No weeks recorded yet.</p>
    {:else}
        <svg class="chart" viewBox="0 0 {WIDTH} {HEIGHT + 24}" preserveAspectRatio="none" role="img" aria-label="Weekly running volume against plan">
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
                    <title>{axisDate(week.start)} — {bar.value.toFixed(1)} km{week.targetKm ? ` of ${week.targetKm} km planned` : ""}</title>
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

        <div class="axis">
            {#each shown as week, i}
                <span class:show={i === 0 || i === shown.length - 1 || i % 4 === 0}>{axisDate(week.start)}</span>
            {/each}
        </div>
    {/if}
</section>

<style>
    .card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-4);
        margin-bottom: var(--space-4);
        flex-wrap: wrap;
    }
    h2 {
        font-family: var(--font-serif);
        font-size: var(--font-lg);
        font-weight: 600;
        color: var(--header-colour);
        margin: 0;
    }
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

    .chart {
        width: 100%;
        height: 190px;
        display: block;
        overflow: visible;
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

    .axis {
        display: flex;
        margin-top: var(--space-2);
    }
    .axis span {
        flex: 1;
        text-align: center;
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0;
        white-space: nowrap;
    }
    .axis span.show { opacity: 0.6; }

    .empty {
        font-size: var(--font-sm);
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin: 0;
    }
</style>
