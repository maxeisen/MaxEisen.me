<script>
    import ActivityModalFrame from "../Activity/ActivityModalFrame.svelte";
    import RideDetails from "./sections/RideDetails.svelte";
    import { fetchJsonSwr } from "../../lib/data/swrCache.js";
    import { daysAgo, shortDate } from "../Activity/lib/format.js";

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

<ActivityModalFrame {when} {loading} id={shown?.id}>
    <RideDetails ride={shown} />
</ActivityModalFrame>
