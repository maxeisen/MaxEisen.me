<!-- Sleep and overnight heart rate from Oura. Sits beside the fitness model, never inside it. -->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import ChartFrame from "../charts/ChartFrame.svelte";
    import Bars from "../charts/Bars.svelte";
    import Stat from "../../../lib/ui/Stat.svelte";
    import StatGrid from "../../../lib/ui/StatGrid.svelte";
    import Tag from "../../../lib/ui/Tag.svelte";
    import { bars, xPct, yPct } from "../lib/chart.js";
    import { formatDuration, shortDate } from "../lib/format.js";
    import { GLOSSARY } from "../../Training/lib/glossary.js";
    import { RHR_RISE_BPM, SLEEP_TARGET_SEC } from "../../../../netlify/functions/_shared/training/constants.js";

    let { recovery = null, info = GLOSSARY.recovery } = $props();

    // Matching the server's thresholds (recovery.js). Imported from the
    // same constants module the engine uses, so the panel and the advice
    // cannot disagree about the same night.

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
                    colour: night.sleepSec < SLEEP_TARGET_SEC ? "var(--tone-warn)" : "var(--series-1)",
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

    const signed = (value, unit) =>
        Number.isFinite(value) ? `${value > 0 ? "+" : ""}${Math.round(value)}${unit}` : "—";

    // Form is computed from the training log and nothing else, so on its own
    // it can only tell you what you already told it. This is whether the body
    // agrees — and the two cases worth a sentence are the ones where it
    // doesn't. See _shared/training/response.js.
    const strain = $derived(recovery?.response?.strain || null);
    // Signed, because form is a quantity whose sign is the whole message: a
    // bare "3" beside "-31" reads as a small number rather than a fresh one.
    const form = $derived(Number.isFinite(strain?.tsb) ? signed(strain.tsb, "") : null);

    const verdict = $derived.by(() => {
        if (strain?.state === "absorbing") {
            return {
                tone: "good",
                text: `Form is ${form} from the training alone, and your overnight numbers are sitting at baseline. That's a body absorbing the training rather than falling behind it.`,
            };
        }
        if (strain?.state === "buried") {
            return {
                tone: "bad",
                text: `Form is ${form} and your body agrees with it${strain.temperatureUp ? ", with skin temperature up as well" : ""}. Fatigue the training explains, but not somewhere to live.`,
            };
        }
        if (strain?.state === "unexplained") {
            return {
                tone: "warn",
                text: `Form is ${form}, so the training doesn't explain this${strain.temperatureUp ? `, and skin temperature is ${strain.temperatureDeviationC.toFixed(1)} °C above your normal` : ""}. A body under strain with no load behind it is more often illness, travel or a run of short nights.`,
            };
        }
        return null;
    });
</script>

<Card title="Recovery" {info}>
    {#if !recovery}
        <p class="card-empty">Nothing from the ring yet.</p>
    {:else}
        <div class="headline">
            <Stat
                size="xl"
                label="Average night, last 7"
                value={Number.isFinite(sleep.recent) ? formatDuration(sleep.recent) : "—"}
            />
            <Tag tone={status.tone === "neutral" ? "neutral" : status.tone} dot size="md">{status.label}</Tag>
        </div>

        {#if verdict}
            <p class="verdict tone-{verdict.tone}">{verdict.text}</p>
        {/if}

        {#if columns.length}
            <div class="chart">
                <ChartFrame height={CHART_H} yTicks={Y_TICKS} {scrub} label="Sleep each night over the last fortnight">
                    <!-- The seven-hour floor: a threshold the bars are read
                         against, drawn over the gridlines rather than as one. -->
                    <div class="target" style:bottom="{100 - (targetY / CHART_H) * 100}%"></div>
                    <Bars
                        layout={columns}
                        width={CHART_W}
                        height={CHART_H}
                        max={18}
                        colorFor={(i) => (columns[i].value > 0 && columns[i].value < SLEEP_TARGET_SEC ? "var(--tone-warn)" : null)}
                    />
                </ChartFrame>
            </div>
            <p class="chart-unit">Nightly sleep · line at {formatDuration(SLEEP_TARGET_SEC)}</p>
        {/if}

        <div class="details">
        <StatGrid class="detail" rule="top" min={100}>
            <Stat
                label="Resting HR"
                value={Number.isFinite(restingHr.recent) ? `${Math.round(restingHr.recent)} bpm` : "—"}
                note={delta(restingHr.delta, "on baseline")}
                tone={hrUp ? "warn" : null}
            />
            <Stat
                label="HRV"
                value={Number.isFinite(hrv.recent) ? `${Math.round(hrv.recent)} ms` : "—"}
                note={delta(hrv.delta, "on baseline")}
            />
            <Stat
                label="Sleep vs baseline"
                value={delta(Number.isFinite(sleep.delta) ? sleep.delta / 60 : null, "min")}
                note={Number.isFinite(sleep.baseline) ? `${formatDuration(sleep.baseline)} normal` : "—"}
                tone={Number.isFinite(sleep.delta) && sleep.delta < 0 ? "warn" : null}
            />
            <!-- Dated, because on a morning before the ring has synced the
                 most recent night on record is the one before. -->
            <Stat
                label="Last night"
                value={latest?.sleepSec ? formatDuration(latest.sleepSec) : "—"}
                note={latest?.day ? shortDate(latest.day) : "—"}
            />
        </StatGrid>
        </div>
    {/if}
</Card>

<style>
    .headline {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--space-3) var(--space-4);
        flex-wrap: wrap;
    }

    /* Read against the training rather than the month, so it sits between
       the headline and the chart. */
    .verdict {
        margin: var(--space-4) 0 0;
        padding-left: var(--space-3);
        border-left: 2px solid var(--border-strong);
        font-size: var(--font-sm);
        line-height: 1.5;
        color: var(--text);
    }
    .verdict.tone-good { border-left-color: var(--tone-good); }
    .verdict.tone-warn { border-left-color: var(--tone-warn); }
    .verdict.tone-bad { border-left-color: var(--tone-bad); }

    .chart { margin-top: var(--space-5); }
    .target {
        position: absolute;
        left: 0;
        right: 0;
        border-top: 1px dashed var(--text-3);
        z-index: 1;
        pointer-events: none;
    }
    .details { margin-top: var(--space-4); }
</style>
