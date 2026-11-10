<!--
    Last night's recovery, from the Oura ring by way of the training summary:
    the readiness figure /running shows (form, sleep, HRV and resting heart
    rate against their 28-day baselines), what it suggests, and the readings
    behind it.

    Size tiers (container queries on the slot): headline and readings side
    by side when wide; readings drop to a second row, then to two of the
    four, as the slot narrows or shortens.
-->
<script>
    import { onMount, onDestroy } from "svelte";
    import WidgetHeader from "./WidgetHeader.svelte";
    import Spinner from "../../../lib/ui/Spinner.svelte";
    import { training, subscribeTraining, reportTraining } from "../lib/trainingFeed.svelte.js";
    import { shortDate, signed } from "../../Activity/lib/format.js";

    let { onavailability = () => {} } = $props();

    $effect(() => {
        reportTraining((data) => Boolean(data.recovery), onavailability);
    });

    // Same wording as the /running Today card.
    const STRAIN = {
        absorbing: "Absorbing the training",
        buried: "Body agrees you're tired",
        unexplained: "Training doesn't explain this",
    };

    const recovery = $derived(training.data?.recovery ?? null);
    const readings = $derived(recovery?.readings ?? {});

    function hours(sec) {
        if (!Number.isFinite(sec)) return "—";
        const h = Math.floor(sec / 3600);
        const m = Math.round((sec % 3600) / 60);
        return `${h}h${String(m).padStart(2, "0")}`;
    }
    function vs(value, baseline, unit = "") {
        if (!Number.isFinite(value) || !Number.isFinite(baseline)) return "";
        return `${signed(value - baseline, 0)}${unit} vs usual`;
    }

    const items = $derived([
        { key: "sleep", label: "Sleep", value: hours(readings.sleepSec), note: Number.isFinite(readings.sleepSec) && Number.isFinite(readings.sleepBaselineSec) ? `${signed((readings.sleepSec - readings.sleepBaselineSec) / 3600)}h vs usual` : "" },
        { key: "hrv", label: "HRV", value: Number.isFinite(readings.averageHrv) ? `${Math.round(readings.averageHrv)} ms` : "—", note: vs(readings.averageHrv, readings.hrvBaseline) },
        { key: "rhr", label: "Resting HR", value: Number.isFinite(readings.restingHr) ? `${Math.round(readings.restingHr)}` : "—", note: vs(readings.restingHr, readings.rhrBaseline) },
        { key: "oura", label: "Oura readiness", value: Number.isFinite(recovery?.readinessScore) ? String(recovery.readinessScore) : "—", note: Number.isFinite(recovery?.sleepScore) ? `sleep score ${recovery.sleepScore}` : "" },
    ]);

    const caption = $derived(
        [STRAIN[recovery?.strain] || "Readiness", recovery?.night ? shortDate(recovery.night) : ""].filter(Boolean).join(" · "),
    );

    let unsubscribe;
    onMount(() => { unsubscribe = subscribeTraining(); });
    onDestroy(() => unsubscribe?.());
</script>

<WidgetHeader label="Recovery" profileHref="/running" profileLabel="Running" external={false} />

{#if !recovery}
    <div class="widget-loading" role="status" aria-label="Loading">
        <Spinner size={24} stroke={2} />
    </div>
{:else}
    <div class="r">
        <div class="r-head">
            <span class="r-value">{Number.isFinite(recovery.value) ? signed(recovery.value) : "—"}</span>
            <span class="r-caption">{caption}</span>
        </div>
        <dl class="r-items">
            {#each items as item (item.key)}
                <div class="r-item">
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                    {#if item.note}<dd class="r-note">{item.note}</dd>{/if}
                </div>
            {/each}
        </dl>
    </div>
{/if}

<style>
    .r {
        display: flex;
        align-items: center;
        gap: var(--space-5);
        flex: 1;
        min-height: 0;
    }
    .r-head { display: flex; flex-direction: column; flex: none; min-width: 0; }
    .r-value {
        font-size: clamp(1.5rem, min(7cqi, 30cqh), 2.5rem);
        font-weight: var(--weight-semibold);
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.02em;
        line-height: 1.1;
        color: var(--text-strong);
    }
    .r-caption { font-size: var(--font-xs); color: var(--text-2); white-space: nowrap; }
    .r-items {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-2) var(--space-4);
        flex: 1;
        min-width: 0;
        margin: 0;
    }
    .r-item { min-width: 0; }
    dt { font-size: var(--font-2xs); color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    dd {
        margin: 0;
        font-size: var(--font-sm);
        font-weight: var(--weight-semibold);
        font-variant-numeric: tabular-nums;
        color: var(--text-strong);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    dd.r-note { font-size: var(--font-2xs); font-weight: var(--weight-regular); color: var(--text-3); }

    @container slot (max-width: 620px) {
        .r-items { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    /* Narrow: the headline above, the readings below. */
    @container slot (max-width: 440px) {
        .r { flex-direction: column; align-items: stretch; gap: var(--space-2); }
        .r-head { flex-direction: row; align-items: baseline; gap: var(--space-3); }
    }
    @container slot (max-height: 150px) {
        .r-items { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        dd.r-note { display: none; }
    }
    @container slot (max-height: 150px) and (max-width: 620px) {
        .r-item:nth-child(n + 3) { display: none; }
        .r-items { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    /* A strip: headline beside two or four readings, one line each. */
    @container slot (max-height: 110px) {
        .r { flex-direction: row; align-items: center; gap: var(--space-4); }
        .r-head { flex-direction: column; }
        .r-caption { display: none; }
    }
</style>
