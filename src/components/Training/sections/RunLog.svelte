<!-- Recent activity, newest first, matched against the plan. -->
<script>
    import Tag from "../../../lib/ui/Tag.svelte";
    import { getContext } from "svelte";
    import RunModal from "../RunModal.svelte";
    import ActivityLog from "../../Activity/sections/ActivityLog.svelte";
    import { formatDistance, formatDuration, pace, shortDate, speed, timeTaken } from "../../Activity/lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";
    import { stravaTag } from "../lib/runTags.js";

    let { runs = [], total = null } = $props();

    const modal = getContext("simple-modal");

    function openRun(run) {
        modal.open(RunModal, { run });
    }

    const isRun = (run) => run.sport !== "ride" && run.sport !== "strength";

    function rowClass(run) {
        const ride = run.sport === "ride";
        const strength = run.sport === "strength";
        const planned = run.plan?.planned === true;
        const tracked = run.plan != null;
        const names = [];
        if (tracked && !planned && isRun(run)) names.push("extra");
        if (ride) names.push("ride");
        if (strength) names.push("strength");
        return names.join(" ");
    }

    const plannedCount = $derived(runs.filter((r) => r.plan?.planned).length);
    const trackingPlan = $derived(runs.some((r) => r.plan));
    const runCount = $derived(runs.filter((r) => r.sport === "run" || !r.sport).length);
    const rideCount = $derived(runs.filter((r) => r.sport === "ride").length);
    const strengthCount = $derived(runs.filter((r) => r.sport === "strength").length);

    const RIDE_NOTE =
        "Shown for context only. Cycling builds no running-specific durability, so rides count"
        + " towards nothing here — not weekly volume, fitness, fatigue or injury risk.";
    const STRENGTH_NOTE =
        "Shown for context only. Strength is on the plan, but it does not count toward running volume, fitness or the race projection.";
</script>

{#snippet row(run)}
    {@const isRide = run.sport === "ride"}
    {@const isStrength = run.sport === "strength"}
    {@const tag = stravaTag(run)}
    {@const planned = run.plan?.planned === true}
    {@const hilly = Number.isFinite(run.gapPaceSecPerKm)
        && Math.abs(run.gapPaceSecPerKm - run.paceSecPerKm) > 5}
    <div class="row-main">
        <span class="row-name">{run.name}</span>
        <span class="row-meta">
            {shortDate(run.startDateLocal)}
            {#if isRide}
                <Tag outline class="ride-tag" title={RIDE_NOTE}>ride</Tag>
            {:else if isStrength}
                <Tag outline class="ride-tag" title={STRENGTH_NOTE}>strength</Tag>
            {:else if planned}
                <Tag tone="good" class="plan" title={run.plan.detail || ""}>{run.plan.type || "planned"}</Tag>
            {:else if run.plan}
                <Tag outline class="extra">extra</Tag>
            {/if}
            {#if tag && !isRide && !isStrength}<Tag>{tag}</Tag>{/if}
            {#if run.averageHr && !isStrength}· {Math.round(run.averageHr)} bpm{/if}
            {#if run.elevationGainM > 50}· {Math.round(run.elevationGainM)} m up{/if}
        </span>
        {#each run.notes || [] as note, i (i)}
            <span class="row-note">
                <span class="note-label">{note.kind === "excuse" ? "why" : "note"}</span>
                {note.text}
            </span>
        {/each}
    </div>

    <div class="row-stat">
        {#if isStrength}
            <strong>{timeTaken(run.movingTimeSec)}</strong>
            <span>moving</span>
        {:else}
            <strong>{formatDistance(run.distanceM)}</strong>
            <span>{formatDuration(run.movingTimeSec)}{#if planned && run.plan.distanceKm}&nbsp;· {run.plan.distanceKm} km planned{/if}</span>
        {/if}
    </div>

    <div class="row-stat">
        {#if isRide}
            <strong>{speed(run.distanceM, run.movingTimeSec)}</strong>
            <span>avg speed</span>
        {:else if isStrength}
            <strong>{run.averageHr ? `${Math.round(run.averageHr)} bpm` : "—"}</strong>
            <span>avg HR</span>
        {:else}
            <strong>{pace(run.paceSecPerKm)}</strong>
            <span class:adjusted={hilly}>
                {Number.isFinite(run.gapPaceSecPerKm) ? `${pace(run.gapPaceSecPerKm)} GAP` : "—"}
            </span>
        {/if}
    </div>
{/snippet}

<ActivityLog
    items={runs}
    info={GLOSSARY.runs}
    isPrimary={isRun}
    {rowClass}
    onOpen={openRun}
    primary={row}
    context={row}
>
    {#snippet summary()}
        {#if runs.length}
            <span>
                {#if Number.isFinite(total) && total > runCount}
                    latest {runCount} of {total}
                {:else}
                    {runCount} runs
                {/if}
                {#if trackingPlan} · {plannedCount} planned{/if}
                {#if rideCount} · {rideCount} {rideCount === 1 ? "ride" : "rides"}{/if}
                {#if strengthCount} · {strengthCount} strength{/if}
            </span>
        {/if}
    {/snippet}
</ActivityLog>

<style>
    .row-note {
        display: block;
        margin-top: var(--space-1);
        font-size: var(--font-xs);
        line-height: 1.55;
        font-style: italic;
        color: var(--text);
    }
    .note-label {
        margin-right: var(--space-2);
        font-style: normal;
        font-weight: var(--weight-medium);
        color: var(--text-3);
    }
    .row-stat span.adjusted { color: var(--text-2); font-weight: var(--weight-medium); }
</style>
