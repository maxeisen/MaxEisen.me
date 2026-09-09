<!--
    The most recent run: what it was, the pace/HR trace, and what it moved.
-->
<script>
    import Card from "../Card.svelte";
    import LastRunChart from "../charts/LastRunChart.svelte";
    import { daysAgo, formatDistance, pace, pct, signed, timeTaken } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";
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
        if (load.daysSinceAsHard === null) return "the hardest run of the block so far";
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

    function article(word) {
        return /^[aeiou]/i.test(word) ? "An" : "A";
    }

    function relativeLoadNote() {
        return load?.vsTypicalPct > 0 && load.runsCompared >= 3
            ? `${Math.round(load.vsTypicalPct)}% of typical`
            : null;
    }
</script>

<Card title="Last run" info={GLOSSARY.lastRun}>
    {#snippet aside()}
        {#if run}
            <span class="when">{daysAgo(run.daysAgo)}</span>
        {/if}
    {/snippet}

    {#if !run}
        <p class="card-empty">Nothing synced yet.</p>
    {:else}
        <a class="title" href="https://www.strava.com/activities/{run.id}" target="_blank" rel="noreferrer">
            {run.name}
        </a>

        <p class="tags">
            {#if planned}
                <span class="tag plan" title={run.plan.detail || ""}>{run.plan.type || "planned"}</span>
            {:else}
                <span class="tag extra">extra</span>
            {/if}
            {#if stravaTag}<span class="tag">{stravaTag}</span>{/if}
            {#if run.effort}<span class="tag effort-{run.effort}">{run.effort}</span>{/if}
            {#if planned && run.plan.distanceKm}<span class="planned-km">{run.plan.distanceKm} km asked for</span>{/if}
        </p>

        <div class="headline">
            <div class="stat">
                <strong>{formatDistance(run.distanceM)}</strong>
                <span>distance</span>
            </div>
            <div class="stat">
                <strong>{timeTaken(run.movingTimeSec)}</strong>
                <span>moving</span>
            </div>
            <div class="stat">
                <strong>{pace(run.paceSecPerKm)}</strong>
                <span>average pace</span>
            </div>
            <div class="stat">
                <strong>{beatsShown}</strong>
                <span>{run.maxHr && run.averageHr ? "average/max hr" : "average hr"}</span>
            </div>
        </div>

        <LastRunChart {run} />

        {#if changes.length}
            <div class="impact">
                <h3>What it did</h3>
                <div class="changes">
                    {#each changes as change (change.key)}
                        <div class="change" class:good={change.good}>
                            <span class="change-label">{change.label}</span>
                            <strong>{signed(change.delta)}</strong>
                            <span class="change-value">to {change.value.toFixed(1)}</span>
                        </div>
                    {/each}
                </div>
                <p class="verdict">
                    {#if run.runsThatDay > 1}
                        The day's change, across {run.runsThatDay} runs.
                    {/if}
                    {#if relativeSize}
                        {article(run.effort || "steady")} {run.effort || "steady"} run,
                        {relativeSize}{standout ? `, and ${standout}` : ""}.
                    {/if}
                </p>
            </div>
        {/if}

        {#each run.notes || [] as note, i (i)}
            <p class="note">
                <span class="note-label">{note.kind === "excuse" ? "why" : "note"}</span>
                {note.text}
            </p>
        {/each}

        {#if facts.length}
            <dl class="facts">
                {#each facts as fact (fact.term)}
                    <div>
                        <dt>{fact.term}</dt>
                        <dd>{fact.value}</dd>
                        {#if fact.note}<dd class="note">{fact.note}</dd>{/if}
                    </div>
                {/each}
            </dl>
        {/if}
    {/if}
</Card>

<style>
    .when {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.7;
    }

    .title {
        display: block;
        font-family: var(--font-sans);
        font-size: var(--font-lg);
        font-weight: 600;
        color: var(--header-colour);
        text-decoration: none;
        line-height: 1.2;
    }
    .title:hover { color: var(--main-green); }

    .tags {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: var(--space-2) 0 0;
        font-size: var(--font-2xs);
    }
    .tag.effort-hard { background: var(--tone-bad-bg); color: var(--tone-bad); }
    .tag.effort-moderate { background: var(--tone-warn-bg); color: var(--tone-warn); }
    .tag.effort-easy { background: var(--tone-good-bg); color: var(--tone-good); }
    .planned-km {
        color: var(--paragraph-colour);
        opacity: 0.65;
    }

    .headline {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
        gap: var(--space-3);
        margin-top: var(--space-4);
        padding: var(--space-3) var(--space-4);
        background: var(--item-background);
        border-radius: var(--radius-sm);
    }
    .stat { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .stat strong {
        font-family: var(--font-sans);
        font-size: var(--font-md);
        font-weight: 700;
        color: var(--header-colour);
        line-height: 1.1;
    }
    .stat span {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--paragraph-colour);
        opacity: 0.65;
    }

    .impact { margin-top: var(--space-5); }
    .impact h3 {
        margin: 0 0 var(--space-2);
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--main-green);
        font-weight: 600;
    }
    .changes {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-2);
    }
    .change {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: var(--space-3);
        background: var(--item-background);
        border-radius: var(--radius-sm);
        border-left: 2px solid var(--main-green-translucent);
    }
    .change.good { border-left-color: var(--tone-good); }
    .change-label {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--paragraph-colour);
        opacity: 0.7;
    }
    .change strong {
        font-family: var(--font-sans);
        font-size: var(--font-md);
        font-weight: 700;
        color: var(--header-colour);
        line-height: 1.2;
    }
    .change.good strong { color: var(--tone-good); }
    .change-value {
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.6;
    }
    .verdict {
        margin: var(--space-3) 0 0;
        font-size: var(--font-sm);
        line-height: 1.5;
        color: var(--paragraph-colour);
    }

    .note {
        margin: var(--space-3) 0 0;
        padding-left: var(--space-3);
        border-left: 2px solid var(--main-green-translucent);
        font-size: var(--font-xs);
        line-height: 1.6;
        font-style: italic;
        color: var(--paragraph-colour);
    }
    .note-label {
        font-style: normal;
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--main-green);
        margin-right: var(--space-2);
    }

    .facts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
        gap: var(--space-3);
        margin: var(--space-4) 0 0;
    }
    .facts div { display: flex; flex-direction: column; gap: 1px; }
    dt {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--main-green);
    }
    dd {
        margin: 0;
        font-family: var(--font-sans);
        font-size: var(--font-md);
        font-weight: 600;
        color: var(--header-colour);
    }
    dd.note {
        font-family: inherit;
        font-size: var(--font-2xs);
        font-weight: 400;
        color: var(--paragraph-colour);
        opacity: 0.65;
    }

    @media (max-width: 540px) {
        .changes { grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); }
    }
</style>
