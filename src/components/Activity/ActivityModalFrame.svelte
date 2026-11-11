<!--
    The frame around an activity opened from a log: when it was, a loading
    note while the full detail arrives, the details (children), and a link
    out to Strava. Shared by the run and ride modals.
-->
<script>
    import Spinner from "../../lib/ui/Spinner.svelte";

    let { when = "", loading = false, id = null, children } = $props();
</script>

<div class="activity-modal">
    <div class="top">
        {#if when}<span>{when}</span>{/if}
        {#if loading}
            <span class="loading" role="status" aria-label="Loading detail">
                <Spinner size={12} stroke={2} /> Loading detail…
            </span>
        {/if}
    </div>

    {@render children()}

    {#if id}
        <a class="strava-link" href="https://www.strava.com/activities/{id}" target="_blank" rel="noreferrer">
            View on Strava
        </a>
    {/if}
</div>

<style>
    .activity-modal { text-align: left; }
    .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        min-height: 1.2em;
        margin-bottom: var(--space-2);
        font-size: var(--font-xs);
        color: var(--text-2);
    }
    .loading { display: inline-flex; align-items: center; gap: var(--space-2); color: var(--text-3); }
    .strava-link {
        display: inline-block;
        margin-top: var(--space-5);
        font-size: var(--font-sm);
        font-weight: var(--weight-medium);
    }
</style>
