<!--
    Sleep and overnight heart rate, from the Oura ring.

    The one panel here fed by something other than training load, and it stays
    beside the fitness model rather than inside it — nothing on this page moves
    because of these numbers (see _shared/training/recovery.js for why that
    separation is load-bearing). What it adds is the thing load genuinely can't
    see: the same week of running is a different proposition on eight hours a
    night than on six, and the recommendations read both together.

    Every measure is a week against a month, the same acute-versus-chronic
    shape the load panel uses, so "recent against established" means one thing
    across the page.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import ChartFrame from "../charts/ChartFrame.svelte";
    import { bars, xPct, yPct } from "../lib/chart.js";
    import { formatDuration, shortDate } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { recovery = null } = $props();

    // Matching the server's thresholds (recovery.js). Duplicated rather than
    // shipped in the payload because they're constants of the model, not of
    // the data — if they diverge, the panel and the advice would disagree
    // about the same night, which is worse than either being wrong.
    const SLEEP_TARGET_SEC = 7 * 3600;
    const RHR_RISE_BPM = 5;

    const CHART_W = 300;
    const CHART_H = 100;
    const NIGHTS = 14;

    // A fixed ceiling rather than the best night on record, so the seven-hour
    // line sits in the same place from week to week and a good run of sleep
    // doesn't flatten the chart. Nine hours because almost nothing clears it.
    const CEILING_SEC = 9 * 3600;

    // Hand-built rather than niceScale, which reasons in the units it's given
    // and would put gridlines at round numbers of seconds. Hours are the only
    // divisions of a night anyone reads.
    const Y_TICKS = [0, 3, 6, 9].map((h) => ({
        value: h * 3600,
        label: h === 0 ? "0" : `${h}h`,
        pct: ((h * 3600) / CEILING_SEC) * 100,
    }));

    const sleep = $derived(recovery?.sleep || {});
    const restingHr = $derived(recovery?.restingHr || {});
    const hrv = $derived(recovery?.hrv || {});
    const latest = $derived(recovery?.latest || null);

    const shortSleep = $derived(Number.isFinite(sleep.recent) && sleep.recent < SLEEP_TARGET_SEC);
    const hrUp = $derived(Number.isFinite(restingHr.delta) && restingHr.delta >= RHR_RISE_BPM);

    const status = $derived.by(() => {
        if (!Number.isFinite(sleep.recent)) return { label: "Not enough nights yet", tone: "neutral" };
        if (shortSleep && hrUp) return { label: "Not keeping up with the training", tone: "bad" };
        if (shortSleep) return { label: "Sleeping short", tone: "warn" };
        if (hrUp) return { label: "Heart rate up on baseline", tone: "warn" };
        return { label: "Recovering well", tone: "good" };
    });

    // The last fortnight, which is enough to see a pattern without the bars
    // becoming hairlines.
    const nights = $derived((recovery?.series || []).slice(-NIGHTS));
    const columns = $derived(
        bars(nights.map((n) => n.sleepSec || 0), {
            width: CHART_W,
            height: CHART_H,
            max: CEILING_SEC,
            gap: 0.3,
        }),
    );
    const targetY = $derived(CHART_H - (SLEEP_TARGET_SEC / CEILING_SEC) * CHART_H);

    // The panel's three measures are summarised as a week against a month, so
    // the cursor is where a single night's numbers are readable at all — and
    // the night you slept badly and the night your heart rate sat high are
    // usually the same one, which the averages can't show you.
    const scrub = $derived(
        nights.map((night, i) => ({
            key: night.day,
            pct: xPct(columns[i].x + columns[i].width / 2, CHART_W),
            label: shortDate(night.day),
            readouts: [
                {
                    label: "Sleep",
                    value: formatDuration(night.sleepSec || 0),
                    colour: night.sleepSec < SLEEP_TARGET_SEC ? "var(--tone-warn)" : "var(--main-green)",
                    yPct: yPct(columns[i].y, CHART_H),
                },
                ...(Number.isFinite(night.restingHr)
                    ? [{ label: "Resting HR", value: `${Math.round(night.restingHr)} bpm` }]
                    : []),
                ...(Number.isFinite(night.averageHrv)
                    ? [{ label: "HRV", value: `${Math.round(night.averageHrv)} ms` }]
                    : []),
            ],
        })),
    );

    // Signed, in the units of whatever it's describing.
    const delta = (value, unit) => {
        if (!Number.isFinite(value)) return "—";
        const rounded = Math.round(value);
        if (rounded === 0) return `level`;
        return `${rounded > 0 ? "+" : ""}${rounded} ${unit}`;
    };
</script>

<Card title="Recovery" info={GLOSSARY.recovery}>
    {#if !recovery}
        <p class="card-empty">Nothing from the ring yet.</p>
    {:else}
        <div class="headline">
            <div class="value tone-{status.tone}">
                <strong>{Number.isFinite(sleep.recent) ? formatDuration(sleep.recent) : "—"}</strong>
                <span>average night, last 7</span>
            </div>
            <p class="status tone-{status.tone}">{status.label}</p>
        </div>

        {#if columns.length}
            <div class="chart">
            <ChartFrame
                height={CHART_H}
                yTicks={Y_TICKS}
                {scrub}
                label="Sleep each night over the last fortnight"
            >
                <svg viewBox="0 0 {CHART_W} {CHART_H}" preserveAspectRatio="none">
                    <!-- The seven-hour floor, drawn over the gridlines rather
                         than as one of them: it's a threshold the bars are
                         read against, not a division of the axis. -->
                    <line class="target" x1="0" x2={CHART_W} y1={targetY} y2={targetY} />
                    {#each columns as bar, i (nights[i].day)}
                        <rect
                            class="bar"
                            class:under={bar.value > 0 && bar.value < SLEEP_TARGET_SEC}
                            x={bar.x}
                            y={bar.y}
                            width={bar.width}
                            height={bar.height}
                            rx="2"
                        ></rect>
                    {/each}
                </svg>
            </ChartFrame>
            </div>
            <p class="chart-unit">nightly sleep · line at {formatDuration(SLEEP_TARGET_SEC)}</p>
        {/if}

        <dl class="detail">
            <div>
                <dt>Resting HR</dt>
                <dd class:over={hrUp}>
                    {Number.isFinite(restingHr.recent) ? `${Math.round(restingHr.recent)} bpm` : "—"}
                </dd>
                <small>{delta(restingHr.delta, "on baseline")}</small>
            </div>
            <div>
                <dt>HRV</dt>
                <dd>{Number.isFinite(hrv.recent) ? `${Math.round(hrv.recent)} ms` : "—"}</dd>
                <small>{delta(hrv.delta, "on baseline")}</small>
            </div>
            <div>
                <dt>Sleep vs baseline</dt>
                <dd class:over={Number.isFinite(sleep.delta) && sleep.delta < 0}>
                    {delta(Number.isFinite(sleep.delta) ? sleep.delta / 60 : null, "min")}
                </dd>
                <small>{Number.isFinite(sleep.baseline) ? `${formatDuration(sleep.baseline)} normal` : "—"}</small>
            </div>
            <div>
                <dt>Last night</dt>
                <dd>{latest?.sleepSec ? formatDuration(latest.sleepSec) : "—"}</dd>
                <!-- Dated, because on a morning before the ring has synced
                     the most recent night on record is the one before. -->
                <small>{latest?.day ? shortDate(latest.day) : "—"}</small>
            </div>
        </dl>
    {/if}
</Card>

<style>
    .headline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
    }
    .value {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
    }
    .value strong {
        font-family: var(--font-sans);
        font-size: var(--font-2xl);
        font-weight: 700;
        letter-spacing: -0.03em;
        color: var(--header-colour);
    }
    .value span {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.7;
    }
    .tone-good strong { color: var(--tone-good); }
    .tone-bad strong { color: var(--tone-bad); }
    .tone-warn strong { color: var(--tone-warn); }

    .status {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--font-sm);
        font-weight: 600;
        margin: 0;
        padding: var(--space-1) var(--space-3);
        border-radius: var(--radius-pill);
        color: var(--paragraph-colour);
        background: var(--item-background);
    }
    .status::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
    }
    .status.tone-good { color: var(--tone-good); background: var(--tone-good-bg); }
    .status.tone-bad { color: var(--tone-bad); background: var(--tone-bad-bg); }
    .status.tone-warn { color: var(--tone-warn); background: var(--tone-warn-bg); }

    /* ChartFrame owns the plot box; what's left here is the ink inside it. */
    .chart { margin-top: var(--space-4); }
    .bar { fill: var(--main-green); opacity: 0.75; }
    /* A night under the floor is the thing the chart is for. */
    .bar.under { fill: var(--tone-warn); opacity: 0.9; }
    /* The plot stretches to its container, so a plain stroke would be drawn
       thicker horizontally than vertically and the dashes would smear. */
    .target {
        stroke: var(--paragraph-colour);
        stroke-width: 1;
        stroke-dasharray: 3 3;
        opacity: 0.55;
        vector-effect: non-scaling-stroke;
    }

    .detail {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: var(--space-3);
        margin: var(--space-4) 0 0 0;
    }
    .detail div { display: flex; flex-direction: column; gap: 2px; }
    dt {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--main-green);
    }
    dd {
        margin: 0;
        font-family: var(--font-sans);
        font-size: var(--font-md);
        font-weight: 600;
        color: var(--header-colour);
    }
    dd.over { color: var(--tone-warn); }
    small {
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.65;
    }
</style>
