<!--
    Injury-risk panel: acute-to-chronic workload ratio and this week's ramp.

    The gauge marks the 0.8-1.5 corridor. Sitting inside it means load is
    growing at a rate the body is keeping up with; drifting above is the
    strongest early warning available from training data alone.
-->
<script>
    import { gaugePosition } from "../lib/chart.js";
    import { pct } from "../lib/format.js";

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

<section class="card">
    <h2>Load and risk</h2>

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
</section>

<style>
    h2 {
        font-family: var(--font-serif);
        font-size: var(--font-lg);
        font-weight: 600;
        color: var(--header-colour);
        margin: 0 0 var(--space-4) 0;
    }

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
        font-family: var(--font-serif);
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
    .tone-good strong { color: var(--main-green); }
    .tone-bad strong { color: var(--color-error-soft); }
    .tone-warn strong { color: #e0c288; }

    .gauge-wrap { flex: 1; min-width: 220px; }
    .gauge { width: 100%; height: 40px; display: block; }
    .track { fill: var(--paragraph-colour); opacity: 0.15; }
    .safe { fill: var(--main-green); opacity: 0.35; }
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
        font-size: var(--font-sm);
        font-weight: 600;
        margin: var(--space-4) 0 0 0;
        color: var(--paragraph-colour);
    }
    .status.tone-good { color: var(--main-green); }
    .status.tone-bad { color: var(--color-error-soft); }
    .status.tone-warn { color: #e0c288; }

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
        font-family: var(--font-serif);
        font-size: var(--font-md);
        font-weight: 600;
        color: var(--header-colour);
    }
    dd.over { color: var(--color-error-soft); }
</style>
