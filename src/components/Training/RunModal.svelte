<!--
    A single run, opened from the recent-activity log, shown in the shared
    modal window (see lib/ui/ModalProvider). The body is RunDetails — the exact
    layout the "Last run" widget uses — with a "how long ago" eyebrow above it
    and an explicit link out to the activity on Strava below.

    The log hands over the lean run it already has (name, distance, pace,
    notes) so the modal paints at once; the trace, per-kilometre splits, zone
    mix and fitness impact are fetched by id from trainingActivity and merged
    in when they land. A completed run never changes, so the fetch is cached
    for a few minutes and a re-open is instant.
-->
<script>
    import RunDetails from "./sections/RunDetails.svelte";
    import Spinner from "../../lib/ui/Spinner.svelte";
    import { fetchJsonSwr } from "../../lib/data/swrCache.js";
    import { daysAgo, shortDate } from "./lib/format.js";

    let { run = null } = $props();

    let detail = $state(null);
    let loading = $state(false);

    $effect(() => {
        const id = run?.id;
        detail = null;
        if (id == null) return;

        loading = true;
        let cancelled = false;
        const settle = (payload) => {
            if (!cancelled && payload?.run) detail = payload.run;
        };
        fetchJsonSwr(`/.netlify/functions/trainingActivity?id=${id}`, {
            maxAgeMs: 5 * 60_000,
            onRevalidate: settle,
        })
            .then(settle)
            // A failed fetch leaves the lean run showing rather than an error —
            // the headline stats are already on screen; only the extras are lost.
            .catch(() => {})
            .finally(() => {
                if (!cancelled) loading = false;
            });

        return () => {
            cancelled = true;
        };
    });

    // Detail wins where it has a field; the lean run fills the gaps until it
    // arrives (and stands in entirely if the fetch fails). Guarded on the id so
    // a detail left over from the previous run can't paint under a new one.
    const shown = $derived(detail && String(detail.id) === String(run?.id) ? { ...run, ...detail } : run);

    const when = $derived.by(() => {
        const date = shortDate(shown?.startDateLocal);
        const relative = Number.isFinite(shown?.daysAgo) ? daysAgo(shown.daysAgo) : "";
        return [date, relative].filter(Boolean).join(" · ");
    });
</script>

<div class="run-modal">
    <div class="eyebrow">
        {#if when}<span class="when">{when}</span>{/if}
        {#if loading}
            <span class="loading" role="status" aria-label="Loading run detail">
                <Spinner size={12} stroke={2} /> loading detail…
            </span>
        {/if}
    </div>

    <RunDetails run={shown} />

    {#if shown?.id}
        <a
            class="strava-link"
            href="https://www.strava.com/activities/{shown.id}"
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

    .eyebrow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-2);
    }

    .when {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.7;
    }

    .loading {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--paragraph-colour);
        opacity: 0.6;
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
