<!-- Acute-to-chronic workload ratio and this week's ramp. -->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import Stat from "../../../lib/ui/Stat.svelte";
    import StatGrid from "../../../lib/ui/StatGrid.svelte";
    import Tag from "../../../lib/ui/Tag.svelte";
    import { gaugePosition } from "../lib/chart.js";
    import { pct } from "../lib/format.js";
    import { GLOSSARY } from "../../Training/lib/glossary.js";
    import { ACWR_CEILING, ACWR_FLOOR } from "../../../../netlify/functions/_shared/training/constants.js";

    // riskWeek is the last whole week, which mid-week is the previous one —
    // week-over-week ramp measured on a Tuesday would otherwise read as a
    // collapse in volume just because most of the week hasn't happened.
    let { acwr = null, riskWeek = null, info = GLOSSARY.load, shareLabel = "Long run share" } = $props();

    const TRACK = 300;
    const DOMAIN = [0.4, 2.0];

    const ratio = $derived(Number.isFinite(acwr?.ratio) ? acwr.ratio : null);
    const marker = $derived(ratio === null ? null : gaugePosition(ratio, DOMAIN, TRACK));
    const safeStart = $derived(gaugePosition(ACWR_FLOOR, DOMAIN, TRACK));
    const safeEnd = $derived(gaugePosition(ACWR_CEILING, DOMAIN, TRACK));

    const status = $derived.by(() => {
        if (ratio === null) return { label: "Not enough history", tone: "neutral" };
        if (ratio > ACWR_CEILING) return { label: "Ramping too fast", tone: "bad" };
        if (ratio < ACWR_FLOOR) return { label: "Detraining", tone: "warn" };
        return { label: "In the safe corridor", tone: "good" };
    });

    const ramp = $derived(Number.isFinite(riskWeek?.rampPct) ? riskWeek.rampPct : null);
    const share = $derived(Number.isFinite(riskWeek?.longRunSharePct) ? riskWeek.longRunSharePct : null);
    const weekLabel = $derived(riskWeek?.isCurrentWeek ? "This week's" : "Last week's");
</script>

<Card title="Load and risk" {info}>
    <div class="gauge-row">
        <Stat
            size="xl"
            label="Acute : chronic"
            value={ratio === null ? "—" : ratio.toFixed(2)}
            tone={status.tone === "neutral" ? null : status.tone}
        />

        <div class="gauge-wrap">
            <svg viewBox="0 0 {TRACK} 24" class="gauge" role="img" aria-label="Acute to chronic workload ratio">
                <rect class="track" x="0" y="8" width={TRACK} height="8" rx="4" />
                <rect class="safe" x={safeStart} y="8" width={safeEnd - safeStart} height="8" rx="4" />
                {#if marker !== null}
                    <line class="marker" x1={marker} x2={marker} y1="2" y2="22" />
                {/if}
            </svg>
            <div class="gauge-labels">
                <span>0.4</span>
                <span>Safe 0.8–1.5</span>
                <span>2.0</span>
            </div>
        </div>
    </div>

    <p class="status">
        <Tag tone={status.tone === "neutral" ? "neutral" : status.tone} dot size="md">{status.label}</Tag>
    </p>

    <StatGrid rule="top" min={100}>
        <Stat
            label="{weekLabel} ramp"
            value={ramp === null ? "—" : `${ramp > 0 ? "+" : ""}${Math.round(ramp)}%`}
            tone={ramp !== null && ramp > 10 ? "warn" : null}
        />
        <Stat label={shareLabel} value={pct(share)} tone={share !== null && share > 35 ? "warn" : null} />
        <Stat label="7-day load" value={Number.isFinite(acwr?.acute) ? Math.round(acwr.acute) : "—"} />
        <Stat label="28-day load" value={Number.isFinite(acwr?.chronic) ? Math.round(acwr.chronic) : "—"} />
    </StatGrid>
</Card>

<style>
    .gauge-row {
        display: flex;
        align-items: flex-end;
        gap: var(--space-5);
        flex-wrap: wrap;
    }
    .gauge-wrap { flex: 1; min-width: 200px; padding-bottom: 2px; }
    .gauge { width: 100%; height: 24px; display: block; }
    .track { fill: var(--surface-2); }
    .safe { fill: var(--tone-good); opacity: 0.3; }
    .marker { stroke: var(--text-strong); stroke-width: 2.5; stroke-linecap: round; }
    .gauge-labels {
        display: flex;
        justify-content: space-between;
        margin-top: var(--space-1);
        font-size: var(--font-2xs);
        font-variant-numeric: tabular-nums;
        color: var(--text-3);
    }
    .status { margin: var(--space-4) 0; }
</style>
