<!--
    Injury-risk panel: acute-to-chronic workload ratio and this week's ramp.

    The gauge marks the 0.8-1.5 corridor. Sitting inside it means load is
    growing at a rate the body is keeping up with; drifting above is the
    strongest early warning available from training data alone.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import { gaugePosition } from "../lib/chart.js";
    import { pct } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    // riskWeek is the last whole week, which mid-week is the previous one —
    // week-over-week ramp measured on a Tuesday would otherwise read as a
    // collapse in volume just because most of the week hasn't happened.
    let { acwr = null, riskWeek = null } = $props();

    const TRACK = 300;
    const DOMAIN = [0.4, 2.0];
    const FLOOR = 0.8;
    const CEILING = 1.5;

    const ratio = $derived(Number.isFinite(acwr?.ratio) ? acwr.ratio : null);
    const marker = $derived(ratio === null ? null : gaugePosition(ratio, DOMAIN, TRACK));
    const safeStart = $derived(gaugePosition(FLOOR, DOMAIN, TRACK));
    const safeEnd = $derived(gaugePosition(CEILING, DOMAIN, TRACK));

    const status = $derived.by(() => {
        if (ratio === null) return { label: "Not enough history", tone: "neutral" };
        if (ratio > CEILING) return { label: "Ramping too fast", tone: "bad" };
        if (ratio < FLOOR) return { label: "Detraining", tone: "warn" };
        return { label: "In the safe corridor", tone: "good" };
    });

    const ramp = $derived(Number.isFinite(riskWeek?.rampPct) ? riskWeek.rampPct : null);
    const share = $derived(Number.isFinite(riskWeek?.longRunSharePct) ? riskWeek.longRunSharePct : null);
    const weekLabel = $derived(riskWeek?.isCurrentWeek ? "This week's" : "Last week's");
</script>

<Card title="Load and risk" info={GLOSSARY.load}>
    <div class="gauge-row">
        <div class="gauge-value tone-{status.tone}">
            <strong>{ratio === null ? "—" : ratio.toFixed(2)}</strong>
            <span>acute : chronic</span>
        </div>

        <div class="gauge-wrap">
            <svg viewBox="0 0 {TRACK} 40" class="gauge" role="img" aria-label="Acute to chronic workload ratio">
                <rect class="track" x="0" y="14" width={TRACK} height="8" rx="4" />
                <rect class="safe" x={safeStart} y="14" width={safeEnd - safeStart} height="8" rx="4" />
                {#if marker !== null}
                    <line class="marker" x1={marker} x2={marker} y1="6" y2="30" />
                {/if}
            </svg>
            <div class="gauge-labels">
                <span>0.4</span>
                <span>safe 0.8–1.5</span>
                <span>2.0</span>
            </div>
        </div>
    </div>

    <p class="status tone-{status.tone}">{status.label}</p>

    <dl class="detail">
        <div>
            <dt>{weekLabel} ramp</dt>
            <dd class:over={ramp !== null && ramp > 10}>
                {ramp === null ? "—" : `${ramp > 0 ? "+" : ""}${Math.round(ramp)}%`}
            </dd>
        </div>
        <div>
            <dt>Long run share</dt>
            <dd class:over={share !== null && share > 35}>{pct(share)}</dd>
        </div>
        <div>
            <dt>7-day load</dt>
            <dd>{Number.isFinite(acwr?.acute) ? Math.round(acwr.acute) : "—"}</dd>
        </div>
        <div>
            <dt>28-day load</dt>
            <dd>{Number.isFinite(acwr?.chronic) ? Math.round(acwr.chronic) : "—"}</dd>
        </div>
    </dl>
</Card>

<style>
    .gauge-row {
        display: flex;
        align-items: center;
        gap: var(--space-5);
        flex-wrap: wrap;
    }
    .gauge-value {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
    }
    .gauge-value strong {
        font-family: var(--font-sans);
        font-size: var(--font-2xl);
        font-weight: 700;
        letter-spacing: -0.03em;
        color: var(--header-colour);
    }
    .gauge-value span {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.7;
    }
    .tone-good strong { color: var(--tone-good); }
    .tone-bad strong { color: var(--tone-bad); }
    .tone-warn strong { color: var(--tone-warn); }

    .gauge-wrap { flex: 1; min-width: 220px; }
    .gauge { width: 100%; height: 40px; display: block; }
    .track { fill: var(--paragraph-colour); opacity: 0.15; }
    .safe { fill: var(--tone-good); opacity: 0.35; }
    .marker {
        stroke: var(--header-colour);
        stroke-width: 3;
        stroke-linecap: round;
    }
    .gauge-labels {
        display: flex;
        justify-content: space-between;
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.6;
    }

    .status {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--font-sm);
        font-weight: 600;
        margin: var(--space-4) 0 0 0;
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
</style>
