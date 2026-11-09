<!--
    A single run's detail — name, effort tags, the headline four-up, the
    pace/HR trace, what it moved, notes and the supporting facts.

    Extracted from the "Last run" widget so the exact same layout and styling
    can be reused inside the run-log modal (see RunModal.svelte). It reads
    every field defensively: the newest run carries the full detail (load,
    zones, splits, trace, fitness impact), while any other run opened from the
    log only has what publicRun serves, and the richer blocks simply don't
    render for it.
-->
<script>
    import LastRunChart from "../charts/LastRunChart.svelte";
    import ActivityHead from "../../Activity/sections/ActivityHead.svelte";
    import WhatItDid from "../../Activity/sections/WhatItDid.svelte";
    import Stat from "../../../lib/ui/Stat.svelte";
    import StatGrid from "../../../lib/ui/StatGrid.svelte";
    import Tag from "../../../lib/ui/Tag.svelte";
    import { formatDistance, pace, pct, timeTaken } from "../../Activity/lib/format.js";
    import { stravaTag as tagFor } from "../lib/runTags.js";

    let { run = null } = $props();

    const STEPS_PER_CYCLE = 2;
    const GAP_DIVERGENCE_SEC = 4;

    const stravaTag = $derived(tagFor(run));
    const beatsShown = $derived.by(() => {
        if (!(run?.averageHr > 0)) return "—";
        const avg = Math.round(run.averageHr);
        return run.maxHr > 0 ? `${avg}/${Math.round(run.maxHr)}` : String(avg);
    });

    const form = $derived(run?.impact?.form || null);
    const load = $derived(run?.impact?.load || null);
    const week = $derived(run?.impact?.week || null);
    const planned = $derived(run?.plan?.planned === true);
    const steady = $derived(run?.effort !== "hard");

    const changes = $derived(
        form
            ? [
                    { key: "fitness", label: "Fitness", value: form.ctl, delta: form.ctlDelta, good: form.ctlDelta > 0 },
                    { key: "fatigue", label: "Fatigue", value: form.atl, delta: form.atlDelta, good: form.atlDelta < 0 },
                    { key: "form", label: "Form", value: form.tsb, delta: form.tsbDelta, good: form.tsbDelta > 0 },
                ]
            : [],
    );

    const relativeSize = $derived.by(() => {
        if (!(load?.vsTypicalPct > 0) || load.runsCompared < 3) return null;
        const ratio = load.vsTypicalPct;
        if (ratio >= 140) return "much bigger than usual for you";
        if (ratio >= 110) return "bigger than usual for you";
        if (ratio > 90) return "about your usual size";
        if (ratio > 60) return "smaller than usual for you";
        return "much smaller than usual for you";
    });

    const standout = $derived.by(() => {
        if (!load || !(load.load > 0) || load.runsCompared < 5) return null;
        if (load.daysSinceAsHard === null) return "the hardest run on record so far";
        if (load.daysSinceAsHard < 7) return null;
        const weeks = Math.round(load.daysSinceAsHard / 7);
        return weeks === 1 ? "the hardest in a week" : `the hardest in ${weeks} weeks`;
    });

    const facts = $derived.by(() => {
        const list = [];
        if (Number.isFinite(load?.load)) {
            list.push({ term: "Load", value: Math.round(load.load), note: relativeLoadNote() });
        }
        if (week?.sharePct > 0) {
            list.push({
                term: "Of the week",
                value: pct(week.sharePct),
                note: `${Math.round(week.targetKm)} km target`,
            });
        }
        if (run?.elevationGainM > 0) {
            list.push({ term: "Climb", value: `${Math.round(run.elevationGainM)} m` });
        }
        if (Math.abs((run?.gapPaceSecPerKm ?? 0) - (run?.paceSecPerKm ?? 0)) >= GAP_DIVERGENCE_SEC) {
            list.push({ term: "Grade adjusted", value: pace(run.gapPaceSecPerKm) });
        }
        if (run?.averageCadence > 0) {
            list.push({ term: "Cadence", value: `${Math.round(run.averageCadence * STEPS_PER_CYCLE)} spm` });
        }
        if (steady && Number.isFinite(run?.decouplingPct)) {
            list.push({
                term: "Drift",
                value: `${run.decouplingPct.toFixed(1)}%`,
                note: run.decouplingPct < 5 ? "aerobically sound" : "ahead of the base",
            });
        }
        if (run?.zoneMix) {
            list.push({ term: "Easy time", value: pct(run.zoneMix.easyPct), note: `${pct(run.zoneMix.hardPct)} hard` });
        }
        return list;
    });

    const EFFORT_TONE = { hard: "bad", moderate: "warn", easy: "good" };

    function article(word) {
        return /^[aeiou]/i.test(word) ? "An" : "A";
    }

    function relativeLoadNote() {
        return load?.vsTypicalPct > 0 && load.runsCompared >= 3
            ? `${Math.round(load.vsTypicalPct)}% of typical`
            : null;
    }
</script>

{#if run}
    <ActivityHead id={run.id} name={run.name}>
        {#snippet tags()}
            {#if planned}
                <Tag tone="good" class="plan" title={run.plan.detail || ""}>{run.plan.type || "planned"}</Tag>
            {:else if run.plan}
                <Tag outline class="extra">extra</Tag>
            {/if}
            {#if stravaTag}<Tag>{stravaTag}</Tag>{/if}
            {#if run.effort}<Tag tone={EFFORT_TONE[run.effort] || "neutral"}>{run.effort}</Tag>{/if}
            {#if planned && run.plan.distanceKm}<span>{run.plan.distanceKm} km asked for</span>{/if}
        {/snippet}
    </ActivityHead>

    <div class="headline">
        <StatGrid rule="both" min={96}>
            <Stat size="lg" label="Distance" value={formatDistance(run.distanceM)} />
            <Stat size="lg" label="Moving" value={timeTaken(run.movingTimeSec)} />
            <Stat size="lg" label="Average pace" value={pace(run.paceSecPerKm)} />
            <Stat size="lg" label={run.maxHr && run.averageHr ? "Average / max HR" : "Average HR"} value={beatsShown} />
        </StatGrid>
    </div>

    <LastRunChart {run} />

    <WhatItDid {changes}>
        {#if run.runsThatDay > 1}
            The day's change, across {run.runsThatDay} runs.
        {/if}
        {#if relativeSize}
            {article(run.effort || "steady")} {run.effort || "steady"} run,
            {relativeSize}{standout ? `, and ${standout}` : ""}.
        {/if}
    </WhatItDid>

    {#each run.notes || [] as note, i (i)}
        <p class="note">
            <span class="note-label">{note.kind === "excuse" ? "Why" : "Note"}</span>
            {note.text}
        </p>
    {/each}

    {#if facts.length}
        <div class="facts">
            <StatGrid rule="top" min={104} gap={3}>
                {#each facts as fact (fact.term)}
                    <Stat label={fact.term} value={fact.value} note={fact.note} />
                {/each}
            </StatGrid>
        </div>
    {/if}
{/if}

<style>
    .headline { margin-top: var(--space-4); }
    .note {
        margin: var(--space-3) 0 0;
        padding-left: var(--space-3);
        border-left: 2px solid var(--border-strong);
        font-size: var(--font-sm);
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
    .facts { margin-top: var(--space-4); }
</style>
