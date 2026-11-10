<!--
    This week, Monday to Sunday: what the running plan has for each day and
    what was actually run and ridden, as a bar per day. Between blocks there's
    no plan, and it's just the runs and rides.

    Size tiers (container queries on the slot): plan labels go when the slot
    is short; day names shrink to a letter when it's narrow.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import WidgetHeader from "./WidgetHeader.svelte";
    import Spinner from "../../../lib/ui/Spinner.svelte";
    import { training, subscribeTraining, reportTraining } from "../lib/trainingFeed.svelte.js";
    import { weekday } from "../../Activity/lib/format.js";

    let { onavailability = () => {} } = $props();

    $effect(() => {
        reportTraining((data) => Array.isArray(data.week) && data.week.length > 0, onavailability);
    });

    const days = $derived(training.data?.week ?? null);
    const peak = $derived(days ? Math.max(1, ...days.map((d) => d.runKm + d.rideKm / 3)) : 1);

    function planOf(day) {
        const run = day.planned.find((p) => p.isRun);
        if (run) return { label: [run.type, Number.isFinite(run.distanceKm) ? run.distanceKm : null].filter(Boolean).join(" "), run: true };
        const other = day.planned[0];
        return other ? { label: other.type, run: false } : null;
    }

    function stateOf(day, plan) {
        if (plan?.run && day.runKm > 0) return "done";
        if (plan?.run && day.isPast) return "missed";
        return null;
    }

    // Rides count a third as much as runs toward the bar's height: a 40 km
    // ride and a 13 km run are about the same morning.
    const rows = $derived(
        (days || []).map((day) => {
            const plan = planOf(day);
            return {
                ...day,
                plan,
                state: stateOf(day, plan),
                runPct: (day.runKm / peak) * 100,
                ridePct: (day.rideKm / 3 / peak) * 100,
                done: [day.runKm > 0 ? `${day.runKm.toFixed(1)} run` : null, day.rideKm > 0 ? `${Math.round(day.rideKm)} ride` : null].filter(Boolean),
            };
        }),
    );

    let unsubscribe;
    onMount(() => { unsubscribe = subscribeTraining(); });
    onDestroy(() => unsubscribe?.());
</script>

<WidgetHeader label="This week" profileHref="/running" profileLabel="Running" external={false} />

{#if !days}
    <div class="widget-loading" role="status" aria-label="Loading">
        <Spinner size={24} stroke={2} />
    </div>
{:else}
    <ol class="wk">
        {#each rows as day (day.date)}
            <li
                class="wk-day"
                class:today={day.isToday}
                class:done={day.state === "done"}
                class:missed={day.state === "missed"}
                title={[weekday(day.date), day.plan?.label, ...day.done].filter(Boolean).join(" · ")}
            >
                <span class="wk-name"><span class="wk-long">{weekday(day.date)}</span><span class="wk-short">{weekday(day.date).slice(0, 1)}</span></span>
                <span class="wk-bar" aria-hidden="true">
                    <span class="wk-ride" style:height="{day.ridePct}%"></span>
                    <span class="wk-run" style:height="{day.runPct}%"></span>
                </span>
                <span class="wk-plan">{day.plan?.label ?? ""}</span>
                <span class="wk-done">{day.done[0] ?? ""}</span>
            </li>
        {/each}
    </ol>
{/if}

<style>
    .wk {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: var(--space-2);
        flex: 1;
        min-height: 0;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .wk-day {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 3px;
        min-width: 0;
        min-height: 0;
        padding: 4px;
        border-radius: var(--radius-sm);
        text-align: center;
    }
    .wk-day.today { background: var(--surface-2); }
    .wk-name { font-size: var(--font-2xs); font-weight: var(--weight-medium); color: var(--text-2); }
    .wk-day.today .wk-name { color: var(--text-strong); }
    .wk-short { display: none; }
    .wk-bar {
        position: relative;
        display: flex;
        flex-direction: column-reverse;
        flex: 1;
        min-height: 6px;
        border-radius: 2px;
        background: color-mix(in oklab, var(--surface-2) 70%, transparent);
        overflow: hidden;
    }
    .wk-run { display: block; background: var(--series-1); }
    .wk-ride { display: block; background: var(--series-2, var(--text-3)); }
    .wk-plan,
    .wk-done {
        font-size: var(--font-2xs);
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .wk-plan { color: var(--text-2); }
    .wk-plan::first-letter { text-transform: uppercase; }
    .wk-done { font-variant-numeric: tabular-nums; color: var(--text-strong); }
    .wk-day.missed .wk-plan { color: var(--text-3); text-decoration: line-through; }
    .wk-day.done .wk-plan { color: var(--tone-good); }

    @container slot (max-width: 420px) {
        .wk { gap: 2px; }
        .wk-long { display: none; }
        .wk-short { display: inline; }
    }
    @container slot (max-height: 150px) {
        .wk-plan { display: none; }
    }
    @container slot (max-height: 110px) {
        .wk-done { display: none; }
        .wk-day { padding: 2px 4px; }
    }
</style>
