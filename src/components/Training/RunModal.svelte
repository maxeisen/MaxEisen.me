<!--
    A single run, opened from the recent-activity log, shown in the shared
    modal window (see lib/ui/ModalProvider). The body is RunDetails — the exact
    layout the "Last run" widget uses — with a "how long ago" eyebrow above it
    and an explicit link out to the activity on Strava below.
-->
<script>
    import RunDetails from "./sections/RunDetails.svelte";
    import { daysAgo, shortDate } from "./lib/format.js";

    let { run = null } = $props();

    // The newest run carries daysAgo from lastRunDetail; any other run opened
    // from the log only has its local start date, so fall back to that.
    const when = $derived.by(() => {
        const date = shortDate(run?.startDateLocal);
        const relative = Number.isFinite(run?.daysAgo) ? daysAgo(run.daysAgo) : "";
        return [date, relative].filter(Boolean).join(" · ");
    });
</script>

<div class="run-modal">
    {#if when}<span class="when">{when}</span>{/if}

    <RunDetails {run} />

    {#if run?.id}
        <a
            class="strava-link"
            href="https://www.strava.com/activities/{run.id}"
            target="_blank"
            rel="noreferrer"
        >
            View on Strava ↗
        </a>
    {/if}
</div>

<style>
    /* The modal window is centred text by convention (the homepage activity
       modal), but a run's stats read as a left-aligned dashboard panel. */
    .run-modal { text-align: left; }

    .when {
        display: block;
        margin-bottom: var(--space-2);
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.7;
    }

    .strava-link {
        display: inline-block;
        margin-top: var(--space-5);
        font-size: var(--font-sm);
        font-weight: 600;
        color: var(--main-green);
        text-decoration: none;
        opacity: 0.9;
        transition: opacity 0.15s ease;
    }
    .strava-link:hover,
    .strava-link:focus-visible {
        opacity: 1;
        text-decoration: underline;
    }
</style>
