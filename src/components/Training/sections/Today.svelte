<!--
    Where today stands, right now.

    Last run is about the most recent session, which may have been Tuesday.
    The fitness series already files today even when you don't run. This strip
    is the briefing that joins those: the FFF change from yesterday's close,
    a readiness number that sits beside form without feeding it, today's
    session if it's still ahead, and what today's session did to the
    projected finish — not a second copy of the header time.

    Pinned under the headlines, outside the rearrangeable grid, because a
    briefing you can bury under Intensity Mix isn't a briefing.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import { clock, signed, shortDate } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { today = null } = $props();

    const STRAIN = {
        absorbing: "body absorbing the block",
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
                note: Number.isFinite(predictedSec) ? `still ${clock(predictedSec)}` : "today's run didn't move it",
                tone: null,
            };
        }
        const faster = sessionDeltaSec < 0;
        return {
            title: `${clock(Math.abs(sessionDeltaSec))} ${faster ? "faster" : "slower"}`,
            note: Number.isFinite(predictedSec) ? `now ${clock(predictedSec)}` : "",
            tone: faster ? "ahead" : "behind",
        };
    });

    const plannedRun = $derived((session?.planned || []).find((s) => s.isRun) || null);

    const sessionCopy = $derived.by(() => {
        if (!session) return { title: "—", note: "" };
        if (session.status === "rest") {
            return { title: "Rest", note: "nothing planned" };
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
            note: "unplanned",
        };
    });

    const staleNight = $derived(
        readiness?.night && today?.date && readiness.night !== today.date
            ? shortDate(readiness.night)
            : null,
    );
</script>

<Card title="Today" info={GLOSSARY.today}>
    {#snippet aside()}
        {#if today?.date}
            <span class="when">{shortDate(today.date)}</span>
        {/if}
    {/snippet}

    <div class="cells">
        <div class="cell">
            <span class="cell-label">Training</span>
            {#if changes.length}
                <div class="changes">
                    {#each changes as change (change.key)}
                        <div class="change" class:good={change.good}>
                            <span class="change-label">{change.label}</span>
                            <strong>{signed(change.delta)}</strong>
                            <span class="change-value">to {change.value.toFixed(1)}</span>
                        </div>
                    {/each}
                </div>
            {:else}
                <p class="empty">No fitness series yet.</p>
            {/if}
        </div>

        <div class="cell">
            <span class="cell-label">Readiness</span>
            {#if readiness}
                <strong class="headline">{signed(readiness.value)}</strong>
                <div class="terms">
                    {#each terms as term (term.key)}
                        <span>
                            {term.label}
                            <em>{term.value}</em>
                        </span>
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

        <div class="cell">
            <span class="cell-label">Session</span>
            <strong class="headline" class:session-title={session?.status === "ahead"}>{sessionCopy.title}</strong>
            {#if sessionCopy.note}
                <p class="caption">{sessionCopy.note}</p>
            {/if}
        </div>

        <div class="cell">
            <span class="cell-label">Projected</span>
            {#if projectionCopy}
                <strong class="headline" class:ahead={projectionCopy.tone === "ahead"} class:behind={projectionCopy.tone === "behind"}>
                    {projectionCopy.title}
                </strong>
                {#if projectionCopy.note}
                    <p class="caption">{projectionCopy.note}</p>
                {/if}
            {:else}
                <p class="empty">
                    No hard effort of 5&nbsp;km or longer yet to project from.
                </p>
            {/if}
        </div>
    </div>
</Card>

<style>
    .when {
        font-size: var(--font-2xs);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--paragraph-colour);
        opacity: 0.7;
    }
    .cells {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-3);
    }
    .cell {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-width: 0;
        padding: var(--space-4);
        background: var(--item-background);
        border-radius: var(--radius-md);
    }
    .cell-label {
        font-size: var(--font-2xs);
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--main-green);
    }
    .headline {
        font-family: var(--font-sans);
        font-size: clamp(1.4rem, 3vw, 1.85rem);
        font-weight: 700;
        letter-spacing: -0.03em;
        line-height: 1.1;
        color: var(--header-colour);
    }
    .headline.ahead { color: var(--tone-good); }
    .headline.behind { color: var(--tone-bad); }
    /* Session types ("easy run"), not distances — capitalize would print "8.0 Km". */
    .session-title { text-transform: capitalize; }
    .caption {
        margin: 0;
        font-size: var(--font-2xs);
        line-height: 1.5;
        color: var(--paragraph-colour);
        opacity: 0.75;
    }
    .empty {
        margin: 0;
        font-size: var(--font-xs);
        color: var(--paragraph-colour);
        opacity: 0.7;
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
        min-width: 0;
    }
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
        opacity: 0.7;
    }
    .terms {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-3);
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.8;
    }
    .terms em {
        font-style: normal;
        font-weight: 600;
        color: var(--header-colour);
        margin-left: 0.25em;
    }

    @media (max-width: 860px) {
        .cells { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 540px) {
        .cells { grid-template-columns: minmax(0, 1fr); }
        .changes { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
</style>
