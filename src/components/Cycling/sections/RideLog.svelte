<script>
    import { getContext } from "svelte";
    import ActivityLog from "../../Activity/sections/ActivityLog.svelte";
    import RideModal from "../RideModal.svelte";
    import { formatDistance, shortDate, speed, timeTaken } from "../../Activity/lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { activities = [], total = null, info = GLOSSARY.rides } = $props();

    const modal = getContext("simple-modal");

    function openRide(ride) {
        modal.open(RideModal, { ride });
    }

    const rideCount = $derived(activities.filter((a) => a.sport === "ride").length);
    const otherCount = $derived(activities.length - rideCount);

    const isRide = (activity) => activity.sport === "ride";
    const rowClass = (activity) => (isRide(activity) ? "" : "ride");
</script>

{#snippet primary(activity)}
    <div class="row-main">
        <span class="row-name">{activity.name}</span>
        <span class="row-meta">{shortDate(activity.startDateLocal)}</span>
    </div>
    <div class="row-stat">
        <strong>{formatDistance(activity.distanceM)}</strong>
        <span>{timeTaken(activity.movingTimeSec)}</span>
    </div>
    <div class="row-stat">
        <strong>{speed(activity.distanceM, activity.movingTimeSec)}</strong>
        <span>avg speed</span>
    </div>
{/snippet}

{#snippet context(activity)}
    <div class="row-main">
        <span class="row-name">{activity.name}</span>
        <span class="row-meta">
            {shortDate(activity.startDateLocal)}
            <span class="tag">{activity.sport === "strength" ? "strength" : "context"}</span>
        </span>
    </div>
    <div class="row-stat">
        <strong>{activity.sport === "strength" ? timeTaken(activity.movingTimeSec) : formatDistance(activity.distanceM)}</strong>
        <span>{activity.sport === "strength" ? "moving" : "distance"}</span>
    </div>
{/snippet}

<ActivityLog
    items={activities}
    {info}
    isPrimary={isRide}
    {rowClass}
    onOpen={openRide}
    {primary}
    {context}
>
    {#snippet summary()}
        {#if activities.length}
            <span class="count">
                {#if Number.isFinite(total) && total > rideCount}
                    latest {rideCount} of {total}
                {:else}
                    {rideCount} {rideCount === 1 ? "ride" : "rides"}
                {/if}
                {#if otherCount} · {otherCount} other{/if}
            </span>
        {/if}
    {/snippet}
</ActivityLog>

<style>
    .count {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.6;
    }
    .row-main { flex: 1; min-width: 0; }
    .row-name {
        display: block;
        font-family: var(--font-sans);
        font-size: var(--font-sm);
        font-weight: 600;
        color: var(--header-colour);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .row-meta {
        display: block;
        margin-top: 3px;
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.7;
    }
    .tag {
        margin-left: 4px;
        padding: 0 5px;
        border: 1px dashed var(--paragraph-colour);
        border-radius: var(--radius-pill);
        text-transform: lowercase;
    }
    .row-stat {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        flex-shrink: 0;
        min-width: 82px;
        text-align: right;
    }
    .row-stat strong {
        font-family: var(--font-sans);
        font-size: var(--font-sm);
        font-weight: 600;
        color: var(--header-colour);
    }
    .row-stat span {
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.65;
    }
</style>
