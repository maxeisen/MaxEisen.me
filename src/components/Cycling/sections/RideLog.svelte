<script>
    import Tag from "../../../lib/ui/Tag.svelte";
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
            <Tag outline>{activity.sport === "strength" ? "strength" : "context"}</Tag>
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
            <span>
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
