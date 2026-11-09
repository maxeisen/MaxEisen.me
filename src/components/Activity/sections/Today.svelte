<!-- Today's briefing: FFF change, readiness, session, projection delta. -->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import Stat from "../../../lib/ui/Stat.svelte";
    import { clock, clockMinutes, signed, shortDate } from "../lib/format.js";
    import { GLOSSARY } from "../../Training/lib/glossary.js";

    let { today = null, inBlock = true, info = GLOSSARY.today } = $props();

    const STRAIN = {
        absorbing: "body absorbing the training",
        buried: "body agrees you're tired",
        unexplained: "training doesn't explain this",
    };

    const training = $derived(today?.training || null);
    const readiness = $derived(today?.readiness || null);
    const session = $derived(today?.session || null);
    const prediction = $derived(today?.prediction || null);

    const changes = $derived(
        training
            ? [
                    { key: "fitness", label: "Fitness", value: training.ctl, delta: training.ctlDelta, good: training.ctlDelta > 0 },
                    { key: "fatigue", label: "Fatigue", value: training.atl, delta: training.atlDelta, good: training.atlDelta < 0 },
                    { key: "form", label: "Form", value: training.tsb, delta: training.tsbDelta, good: training.tsbDelta > 0 },
                ]
            : [],
    );

    const terms = $derived.by(() => {
        if (!readiness) return [];
        const { terms: scores, readings } = readiness;
        const sleepHours =
            Number.isFinite(readings?.sleepSec) && Number.isFinite(readings?.sleepBaselineSec)
                ? (readings.sleepSec - readings.sleepBaselineSec) / 3600
                : null;
        return [
            { key: "form", label: "Form", value: Number.isFinite(scores.form) ? signed(scores.form) : null },
            { key: "sleep", label: "Sleep", value: Number.isFinite(sleepHours) ? `${signed(sleepHours)}h` : null },
            {
                key: "hrv",
                label: "HRV",
                value: Number.isFinite(readings?.averageHrv) ? String(Math.round(readings.averageHrv)) : null,
            },
            { key: "rhr", label: "RHR", value: Number.isFinite(readings?.restingHr) ? String(Math.round(readings.restingHr)) : null },
        ].filter((term) => term.value !== null);
    });

    const projectionCopy = $derived.by(() => {
        if (!prediction) return null;
        const { sessionDeltaSec, predictedSec } = prediction;
        if (sessionDeltaSec === null) {
            return { title: "No change", note: "no session yet", tone: null };
        }
        if (sessionDeltaSec === 0) {
            return {
                title: "No change",
                note: Number.isFinite(predictedSec)
                    ? `still ${clockMinutes(predictedSec)}`
                    : "today's run didn't move it",
                tone: null,
            };
        }
        const faster = sessionDeltaSec < 0;
        return {
            title: `${clock(Math.abs(sessionDeltaSec))} ${faster ? "faster" : "slower"}`,
            note: Number.isFinite(predictedSec) ? `now ${clockMinutes(predictedSec)}` : "",
            tone: faster ? "ahead" : "behind",
        };
    });

    const plannedRun = $derived((session?.planned || []).find((s) => s.isRun) || null);

    // A cell for a session only when there is one: something on the plan for
    // today (a rest day the plan asks for counts) or a run already recorded.
    // Between blocks most days have neither, and "—" would just be filler.
    const hasSession = $derived(
        Boolean(session) && ((session.planned?.length ?? 0) > 0 || session.actualKm > 0 || session.runs > 0),
    );

    const sessionCopy = $derived.by(() => {
        if (!session) return { title: "—", note: "" };
        if (session.status === "rest") {
            // Strength, or a rest day the plan wrote down — no kilometres either way.
            const entry = session.planned?.[0];
            const detail = entry?.detail && entry.detail.toLowerCase() !== String(entry.type || "").toLowerCase()
                ? entry.detail
                : "";
            return { title: entry?.type || "Rest", note: detail || "no running planned" };
        }
        if (session.status === "ahead") {
            const kmLabel = Number.isFinite(plannedRun?.distanceKm)
                ? `${plannedRun.distanceKm} km`
                : "";
            return {
                title: plannedRun?.type || "Session",
                note: [kmLabel, plannedRun?.detail].filter(Boolean).join(" · ") || "still ahead",
            };
        }
        if (session.status === "done") {
            const actual = session.actualKm > 0 ? `${session.actualKm.toFixed(1)} km` : "done";
            const target = Number.isFinite(plannedRun?.distanceKm)
                ? `of ${plannedRun.distanceKm}`
                : "";
            return { title: actual, note: [target, plannedRun?.type].filter(Boolean).join(" · ") };
        }
        return {
            title: session.actualKm > 0 ? `${session.actualKm.toFixed(1)} km` : "Extra",
            note: inBlock ? "unplanned" : "",
        };
    });

    const showProjection = $derived(today != null && Object.hasOwn(today, "prediction"));
    const cellCount = $derived(2 + (hasSession ? 1 : 0) + (showProjection ? 1 : 0));

    const staleNight = $derived(
        readiness?.night && today?.date && readiness.night !== today.date
            ? shortDate(readiness.night)
            : null,
    );
</script>

<Card title="Today" {info}>
    {#snippet aside()}
        {#if today?.date}
            <span>{shortDate(today.date)}</span>
        {/if}
    {/snippet}

    <div class="cells" style:--cells={cellCount}>
        <div class="cell">
            <span class="kicker">Training</span>
            {#if changes.length}
                <div class="changes">
                    {#each changes as change (change.key)}
                        <Stat
                            size="sm"
                            label={change.label}
                            value={signed(change.delta)}
                            note={`to ${change.value.toFixed(1)}`}
                            tone={change.good ? "good" : null}
                        />
                    {/each}
                </div>
            {:else}
                <p class="empty">No fitness series yet.</p>
            {/if}
        </div>

        <div class="cell">
            <span class="kicker">Readiness</span>
            {#if readiness}
                <strong class="headline">{signed(readiness.value)}</strong>
                <div class="terms">
                    {#each terms as term (term.key)}
                        <span>{term.label} <em>{term.value}</em></span>
                    {/each}
                </div>
                {#if STRAIN[readiness.strain] || staleNight}
                    <p class="caption">
                        {#if STRAIN[readiness.strain]}{STRAIN[readiness.strain]}{/if}{#if staleNight}{STRAIN[readiness.strain] ? " · " : ""}from {staleNight}{/if}
                    </p>
                {/if}
            {:else}
                <p class="empty">Nothing from the ring yet.</p>
            {/if}
        </div>

        {#if hasSession}
            <div class="cell">
                <span class="kicker">Session</span>
                <strong class="headline" class:session-title={session.status === "ahead" || session.status === "rest"}>{sessionCopy.title}</strong>
                {#if sessionCopy.note}
                    <p class="caption">{sessionCopy.note}</p>
                {/if}
            </div>
        {/if}

        {#if showProjection}
            <div class="cell">
                <span class="kicker">{inBlock ? "Projected" : "Marathon estimate"}</span>
                {#if projectionCopy}
                    <strong class="headline" class:ahead={projectionCopy.tone === "ahead"} class:behind={projectionCopy.tone === "behind"}>
                        {projectionCopy.title}
                    </strong>
                    {#if projectionCopy.note}
                        <p class="caption">{projectionCopy.note}</p>
                    {/if}
                {:else}
                    <p class="empty">Not enough recent running to project from.</p>
                {/if}
            </div>
        {/if}
    </div>
</Card>

<style>
    /* Columns divided by hairlines rather than boxed: a box inside a card
       is a second surface competing with the first. */
    .cells {
        display: grid;
        grid-template-columns: repeat(var(--cells, 4), minmax(0, 1fr));
    }
    .cell {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-width: 0;
        padding: 0 var(--space-5);
    }
    .cell:first-child { padding-left: 0; }
    .cell:last-child { padding-right: 0; }
    .cell + .cell { border-left: 1px solid var(--border); }

    .headline {
        font-size: var(--font-xl);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.02em;
        line-height: 1.15;
        color: var(--text-strong);
    }
    .headline.ahead { color: var(--tone-good); }
    .headline.behind { color: var(--tone-bad); }
    /* Session types ("easy run"), not distances — capitalize would print "8.0 Km". */
    .session-title { text-transform: capitalize; }
    .caption, .empty {
        margin: 0;
        font-size: var(--font-xs);
        line-height: 1.5;
        color: var(--text-2);
    }
    .changes {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-3);
    }
    .terms {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-3);
        font-size: var(--font-xs);
        color: var(--text-2);
    }
    .terms em {
        margin-left: 0.2em;
        font-style: normal;
        font-weight: var(--weight-semibold);
        color: var(--text-strong);
    }

    @media (max-width: 860px) {
        .cells { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: var(--space-4); }
        .cell:nth-child(odd) { padding-left: 0; border-left: 0; }
        .cell:nth-child(even) { padding-right: 0; }
        .cell:nth-child(n + 3) { padding-top: var(--space-4); border-top: 1px solid var(--border); }
        /* Three cells on two columns: the odd one out takes the full row. */
        .cell:last-child:nth-child(odd) { grid-column: 1 / -1; }
    }
    @media (max-width: 540px) {
        .cells { grid-template-columns: minmax(0, 1fr); }
        .cell, .cell:nth-child(even) { padding: 0; border-left: 0; }
        .cell + .cell { padding-top: var(--space-4); border-top: 1px solid var(--border); }
        .cell:last-child:nth-child(odd) { grid-column: auto; }
    }
</style>
