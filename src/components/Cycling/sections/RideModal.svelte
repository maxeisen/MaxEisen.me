<!-- A ride opened from the log. The lean row paints at once; detail fills in. -->
<script>
    import RideDetails from "./RideDetails.svelte";
    import Spinner from "../../../lib/ui/Spinner.svelte";
    import { fetchJsonSwr } from "../../../lib/data/swrCache.js";
    import { daysAgo, shortDate } from "../../Activity/lib/format.js";

    let { ride = null } = $props();

    let detail = $state(null);
    let loading = $state(false);

    $effect(() => {
        const id = ride?.id;
        detail = null;
        if (id == null) return;

        loading = true;
        let cancelled = false;
        const settle = (payload) => {
            if (!cancelled && payload?.ride) detail = payload.ride;
        };
        fetchJsonSwr(`/.netlify/functions/cyclingActivity?id=${id}`, {
            maxAgeMs: 5 * 60_000,
            onRevalidate: settle,
        })
            .then(settle)
            .catch(() => {})
            .finally(() => {
                if (!cancelled) loading = false;
            });

        return () => {
            cancelled = true;
        };
    });

    const shown = $derived(detail && String(detail.id) === String(ride?.id) ? { ...ride, ...detail } : ride);
    const when = $derived.by(() => {
        const date = shortDate(shown?.startDateLocal || shown?.date);
        const relative = Number.isFinite(shown?.daysAgo) ? daysAgo(shown.daysAgo) : "";
        return [date, relative].filter(Boolean).join(" · ");
    });
</script>

<div class="ride-modal">
    <div class="eyebrow">
        {#if when}<span class="when">{when}</span>{/if}
        {#if loading}
            <span class="loading" role="status" aria-label="Loading ride detail">
                <Spinner size={12} stroke={2} /> loading detail…
            </span>
        {/if}
    </div>
    <RideDetails ride={shown} />
</div>

<style>
    .ride-modal { text-align: left; }
    .eyebrow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-2);
    }
    .when, .loading {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.7;
    }
    .loading { display: inline-flex; align-items: center; gap: var(--space-2); }
</style>
