<!--
    Running or Cycling at a glance, from the training summary: today's
    planned session (running has a plan; cycling doesn't), the last run or
    ride, fitness/fatigue/form with today's change, the race countdown during
    a block, this week's distance, and a six-week form line when there's room.
    Wording and numbers match /running and /cycling, which it links to.

    Size tiers (container queries on the slot): two columns when wide, one
    when narrow; as height runs out the form line goes, then the race, then
    the week, then today's session, leaving the last activity and form.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import WidgetHeader from "./WidgetHeader.svelte";
    import Spinner from "../../../lib/ui/Spinner.svelte";
    import { training, subscribeTraining, reportTraining } from "../lib/trainingFeed.svelte.js";
    import { hasSession, sessionCopy } from "../../Activity/lib/session.js";
    import { km, pace, speed, timeTaken, daysAgo, clockMinutes, signed } from "../../Activity/lib/format.js";

    let { sport = "run", onavailability = () => {} } = $props();

    const isRun = $derived(sport === "run");
    const part = $derived(training.data?.[sport] ?? null);

    $effect(() => {
        reportTraining((data) => Boolean(data[sport]?.last || data[sport]?.form), onavailability);
    });

    const formStats = $derived.by(() => {
        const f = part?.form;
        if (!f) return [];
        return [
            { key: "fitness", label: "Fitness", value: f.ctl, delta: f.ctlDelta, good: f.ctlDelta > 0 },
            { key: "fatigue", label: "Fatigue", value: f.atl, delta: f.atlDelta, good: f.atlDelta < 0 },
            { key: "form", label: "Form", value: f.tsb, delta: f.tsbDelta, good: f.tsbDelta > 0 },
        ];
    });

    const today = $derived(isRun && hasSession(part?.today) ? sessionCopy(part.today, { inBlock: Boolean(part?.race) }) : null);

    const last = $derived(part?.last ?? null);
    const lastStats = $derived.by(() => {
        if (!last) return [];
        const distance = km(last.distanceM);
        if (isRun) return [distance, pace(last.paceSecPerKm), timeTaken(last.movingTimeSec)];
        return [
            distance,
            timeTaken(last.movingTimeSec),
            Number.isFinite(last.averageWatts) ? `${last.averageWatts} W` : speed(last.distanceM, last.movingTimeSec),
        ];
    });

    const lastKicker = $derived(
        last ? [`Last ${isRun ? "run" : "ride"}`, daysAgo(last.daysAgo)].filter(Boolean).join(" · ") : "",
    );

    const race = $derived(part?.race ?? null);
    const raceLead = $derived(
        race ? `${race.label || race.name} · ${race.daysToRace} day${race.daysToRace === 1 ? "" : "s"}` : "",
    );
    const raceNote = $derived.by(() => {
        if (!race) return "";
        const bits = [];
        if (Number.isFinite(race.predictedSec)) bits.push(`projected ${clockMinutes(race.predictedSec)}`);
        if (Number.isFinite(race.goalTimeSec)) bits.push(`goal ${clockMinutes(race.goalTimeSec)}`);
        return bits.join(" · ");
    });

    const weekLine = $derived.by(() => {
        const w = part?.week;
        if (!w) return null;
        if (isRun) {
            return Number.isFinite(w.targetKm) && w.targetKm > 0
                ? `${w.actualKm.toFixed(1)} of ${w.targetKm} km this week`
                : `${w.actualKm.toFixed(1)} km this week`;
        }
        return `${w.actualKm.toFixed(1)} km this week · ${w.rides} ride${w.rides === 1 ? "" : "s"}`;
    });

    // Form over the last six weeks, as a line around zero.
    const spark = $derived.by(() => {
        const points = (part?.formTrend || []).filter((p) => Number.isFinite(p.tsb));
        if (points.length < 2) return null;
        const values = points.map((p) => p.tsb);
        const lo = Math.min(0, ...values);
        const hi = Math.max(0, ...values);
        const span = hi - lo || 1;
        const y = (v) => (30 - ((v - lo) / span) * 28 - 1).toFixed(2);
        const x = (i) => ((i / (points.length - 1)) * 100).toFixed(2);
        return {
            line: points.map((p, i) => `${x(i)},${y(p.tsb)}`).join(" "),
            zero: y(0),
        };
    });

    let unsubscribe;
    onMount(() => { unsubscribe = subscribeTraining(); });
    onDestroy(() => unsubscribe?.());
</script>

<WidgetHeader
    label={isRun ? "Running" : "Cycling"}
    profileHref={isRun ? "/running" : "/cycling"}
    profileLabel="Dashboard"
    external={false}
/>

{#if !part}
    <div class="widget-loading" role="status" aria-label="Loading">
        <Spinner size={24} stroke={2} />
    </div>
{:else}
    <div class="t" class:has-today={today}>
        {#if today}
            <section class="t-today">
                <span class="t-kicker">Today</span>
                <span class="t-title">{today.title}</span>
                {#if today.note}<span class="t-note">{today.note}</span>{/if}
            </section>
        {/if}

        {#if last}
            <section class="t-last">
                <span class="t-kicker">{lastKicker}</span>
                <span class="t-title">{last.name || (isRun ? "Run" : "Ride")}</span>
                <span class="t-stats">{lastStats.join(" · ")}</span>
            </section>
        {/if}

        {#if formStats.length}
            <section class="t-form" aria-label="Fitness, fatigue and form">
                {#each formStats as stat (stat.key)}
                    <div class="t-stat">
                        <span class="t-stat-label">{stat.label}</span>
                        <span class="t-stat-value">{stat.value?.toFixed(1) ?? "—"}</span>
                        <span class="t-stat-delta" class:good={stat.good}>{signed(stat.delta)}</span>
                    </div>
                {/each}
            </section>
        {/if}

        {#if race || weekLine}
            <section class="t-extra">
                {#if race}
                    <span class="t-race"><strong>{raceLead}</strong>{raceNote ? ` · ${raceNote}` : ""}</span>
                {/if}
                {#if weekLine}<span class="t-week">{weekLine}</span>{/if}
            </section>
        {/if}

        {#if spark}
            <svg class="t-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-label="Form over six weeks">
                <line class="t-spark-zero" x1="0" x2="100" y1={spark.zero} y2={spark.zero} />
                <polyline class="t-spark-line" points={spark.line} />
            </svg>
        {/if}
    </div>
{/if}

<style>
    .t {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-content: start;
        gap: var(--space-3);
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }
    section { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .t-kicker { font-size: var(--font-2xs); color: var(--text-2); }
    .t-title {
        font-size: var(--font-md);
        font-weight: var(--weight-semibold);
        color: var(--text-strong);
    }
    /* Plan entries come lower-case ("tempo"); a distance ("9.8 km") must
       stay as it is, so only the first letter is raised. */
    .t-today .t-title::first-letter { text-transform: uppercase; }
    .t-title,
    .t-note,
    .t-stats,
    .t-race,
    .t-week { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .t-note { font-size: var(--font-xs); color: var(--text-2); }
    .t-stats { font-size: var(--font-sm); font-variant-numeric: tabular-nums; color: var(--text); }

    .t-form {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-3);
        padding-top: var(--space-3);
        border-top: 1px solid var(--border);
    }
    .t-stat { display: flex; flex-direction: column; min-width: 0; }
    .t-stat-label { font-size: var(--font-2xs); color: var(--text-2); }
    .t-stat-value {
        font-size: clamp(1.1rem, 4cqi, 1.6rem);
        font-weight: var(--weight-semibold);
        font-variant-numeric: tabular-nums;
        line-height: 1.15;
        color: var(--text-strong);
    }
    .t-stat-delta { font-size: var(--font-xs); font-variant-numeric: tabular-nums; color: var(--text-3); }
    .t-stat-delta.good { color: var(--tone-good); }

    .t-extra { gap: var(--space-1); font-size: var(--font-xs); color: var(--text-2); }
    .t-race strong { font-weight: var(--weight-medium); color: var(--text-strong); }

    .t-spark { width: 100%; height: 100%; min-height: 24px; max-height: 64px; overflow: visible; }
    .t-spark-zero { stroke: var(--border-strong); stroke-width: 1; stroke-dasharray: 2 3; vector-effect: non-scaling-stroke; }
    .t-spark-line { fill: none; stroke: var(--series-1); stroke-width: 1.6; vector-effect: non-scaling-stroke; }

    /* Wide: session and last activity on the left, numbers on the right. */
    @container slot (min-width: 520px) {
        .t {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            grid-template-areas:
                "last form"
                "extra extra"
                "spark spark";
            column-gap: var(--space-5);
        }
        .t.has-today {
            grid-template-areas:
                "today form"
                "last form"
                "extra extra"
                "spark spark";
        }
        .t-today { grid-area: today; }
        .t-last { grid-area: last; }
        .t-form { grid-area: form; align-self: start; padding-top: 0; border-top: 0; }
        .t-extra { grid-area: extra; padding-top: var(--space-3); border-top: 1px solid var(--border); }
        .t-spark { grid-area: spark; }
    }

    /* Shedding, as height runs out. One column (narrow) stacks everything,
       so it starts shedding sooner than two. */
    @container slot (max-height: 360px) {
        .t-spark { display: none; }
    }
    @container slot (max-width: 519px) and (max-height: 440px) {
        .t-spark { display: none; }
    }
    @container slot (max-width: 519px) and (max-height: 340px) {
        .t-today { display: none; }
    }
    @container slot (max-width: 519px) and (max-height: 300px) {
        .t-extra { display: none; }
    }
    @container slot (max-height: 300px) {
        .t-race { display: none; }
    }
    @container slot (max-height: 260px) {
        .t { gap: var(--space-2); }
        .t-extra { display: none; }
    }
    @container slot (max-height: 230px) {
        .t-today { display: none; }
        .t-form { padding-top: var(--space-2); }
    }
    @container slot (max-height: 215px) {
        .t-stat-delta { display: none; }
    }
    @container slot (max-height: 185px) {
        .t-stats { display: none; }
    }
    @container slot (max-height: 160px) {
        .t-last .t-kicker { display: none; }
    }
</style>
