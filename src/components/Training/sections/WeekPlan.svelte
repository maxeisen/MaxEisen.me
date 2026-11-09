<!-- This week against its plan, plus what's coming. -->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import Stat from "../../../lib/ui/Stat.svelte";
    import StatGrid from "../../../lib/ui/StatGrid.svelte";
    import { pct, weekday, weekRange } from "../../Activity/lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { week = null, upcoming = [], inBlock = true } = $props();

    const progress = $derived(
        week?.targetKm > 0
            ? Math.min(100, (week.actualKm / week.targetKm) * 100)
            : null,
    );

    // The long run is one session on one day, so it gets a line rather than a
    // bar: a bar would fill up all week on whichever easy run happened to be
    // the longest so far, which is not a long run in progress.
    const longRun = $derived(week?.longRun || null);

    // A day is only "missed" once it's over. Today's session is still ahead of
    // you at 8am, and calling it missed would be both wrong and demoralising.
    function statusOf(day) {
        const planned = day.planned.filter((s) => s.isRun);
        const ran = day.actualKm > 0;
        if (planned.length === 0) return ran ? (inBlock ? "extra" : "done") : "off";
        if (ran) return "done";
        return day.isPast ? "missed" : "ahead";
    }

    const days = $derived(
        (week?.days || []).map((day) => ({ ...day, status: statusOf(day) })),
    );
</script>

<Card title="This week" info={GLOSSARY.week}>
    {#snippet aside()}
        {#if week?.start}
            <span>{weekRange(week.start)}</span>
        {/if}
    {/snippet}

    {#if !week}
        <p class="card-empty">No runs logged this week yet.</p>
    {:else}
        <div class="metric">
            <div class="metric-head">
                <span class="kicker">Volume</span>
                <strong>
                    {(week.actualKm || 0).toFixed(1)} km
                    {#if week.targetKm}<span class="target">of {week.targetKm}</span>{/if}
                </strong>
            </div>
            {#if progress !== null}
                <div class="track"><div class="fill" style="width: {progress}%"></div></div>
            {:else if week.isPlanned}
                <p class="no-plan">A scheduled down week — no running planned.</p>
            {:else if inBlock}
                <p class="no-plan">No target set for this week.</p>
            {/if}
        </div>

        {#if longRun}
            <p class="long-run {longRun.status}">
                <span class="kicker">Long run</span>
                <!-- A distance actually run is what says it happened, so the
                     done state doesn't need a word for it; the other two do. -->
                {#if longRun.status === "done"}
                    <strong>{longRun.actualKm.toFixed(1)} km</strong>
                    <span class="long-run-note">
                        {longRun.targetKm ? `of ${longRun.targetKm} · ` : ""}{weekday(longRun.date)}
                    </span>
                {:else}
                    <strong>{longRun.targetKm ? `${longRun.targetKm} km` : "planned"}</strong>
                    <span class="long-run-note">
                        · {weekday(longRun.date)}{longRun.status === "missed" ? " · not run" : ""}
                    </span>
                {/if}
            </p>
        {/if}

        {#if days.length}
            <ol class="days">
                {#each days as day (day.date)}
                    <li class="day {day.status}" class:today={day.isToday}>
                        <span class="day-name">{weekday(day.date)} {Number(day.date.slice(8, 10))}</span>
                        <span class="day-plan">
                            {#if day.planned.length}
                                {#each day.planned as session}
                                    <span class="session">
                                        <span class="session-type">{session.type}</span>
                                        <span class="session-detail">{session.detail || ""}</span>
                                    </span>
                                {/each}
                            {:else}
                                <span class="session-detail">—</span>
                            {/if}
                        </span>
                        <span class="day-km">
                            {#if day.actualKm > 0}
                                <strong>{day.actualKm.toFixed(1)}</strong>
                            {:else if day.status === "missed"}
                                <span class="mark">missed</span>
                            {:else}
                                <span class="mark">
                                    {day.planned.find((s) => s.isRun)?.distanceKm ?? ""}
                                </span>
                            {/if}
                        </span>
                    </li>
                {/each}
            </ol>
        {:else if week.keySessions?.length}
            <ul class="key">
                {#each week.keySessions as session}
                    <li>
                        <span class="key-type">{session.type || "key"}</span>
                        {session.detail || ""}
                    </li>
                {/each}
            </ul>
        {/if}

        <StatGrid rule="top" columns={inBlock ? 3 : 2}>
            <Stat label="Runs" value={week.runs} />
            <Stat label="Load" value={Math.round(week.load)} />
            {#if inBlock}
                <Stat label="Of target" value={pct(week.volumePct)} />
            {/if}
        </StatGrid>
    {/if}

    {#if upcoming.length}
        <div class="upcoming">
            <h3 class="kicker">Coming up</h3>
            <ul>
                {#each upcoming as week (week.start)}
                    <li>
                        <span class="week-date">{weekRange(week.start)}</span>
                        <span class="week-km">{week.targetKm ? `${week.targetKm} km` : "—"}</span>
                        <span class="week-long">{week.longRunKm ? `${week.longRunKm} km long` : ""}</span>
                    </li>
                {/each}
            </ul>
        </div>
    {/if}
</Card>

<style>
    .metric { margin-bottom: var(--space-4); }
    .metric-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: var(--space-2);
    }
    .metric-head strong {
        font-size: var(--font-lg);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.01em;
        color: var(--text-strong);
    }
    .target {
        margin-left: var(--space-1);
        font-size: var(--font-xs);
        font-weight: var(--weight-regular);
        color: var(--text-3);
    }
    .track {
        height: 6px;
        border-radius: var(--radius-pill);
        background: var(--surface-2);
        overflow: hidden;
    }
    .fill {
        height: 100%;
        border-radius: var(--radius-pill);
        background: var(--series-1);
        transition: width 0.3s var(--ease);
    }
    .no-plan { margin: 0; font-size: var(--font-xs); color: var(--text-3); }

    .long-run {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: 0 0 var(--space-4);
        font-size: var(--font-sm);
    }
    .long-run .kicker { display: inline; }
    .long-run strong { font-weight: var(--weight-semibold); color: var(--text-strong); }
    .long-run.done strong { color: var(--tone-good); }
    .long-run.missed strong { color: var(--tone-warn); }
    .long-run-note { color: var(--text-3); }

    /* The week as a ruled list; today is marked by weight and a rule, not a
       highlighted box. */
    .days {
        list-style: none;
        margin: 0 0 var(--space-4);
        padding: 0;
        border-top: 1px solid var(--border);
    }
    .day {
        display: grid;
        grid-template-columns: 52px 1fr auto;
        align-items: baseline;
        gap: var(--space-3);
        padding: var(--space-2) 0;
        border-bottom: 1px solid var(--border);
        font-size: var(--font-xs);
        color: var(--text);
    }
    .day.today { box-shadow: inset 2px 0 0 var(--accent); padding-left: var(--space-2); }
    .day.today .day-name { color: var(--text-strong); font-weight: var(--weight-semibold); }
    /* Rest days recede, but not so far that today disappears on the week
       where today happens to be a rest day. */
    .day.off { color: var(--text-3); }
    .day-name {
        font-variant-numeric: tabular-nums;
        color: var(--text-2);
        white-space: nowrap;
    }
    .day-plan { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .session { display: flex; align-items: baseline; gap: var(--space-2); min-width: 0; }
    .session-type {
        font-weight: var(--weight-medium);
        color: var(--text-strong);
        white-space: nowrap;
        text-transform: capitalize;
    }
    .day.off .session-type { color: inherit; }
    .session-detail {
        color: var(--text-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .day-km { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .day-km strong { font-weight: var(--weight-semibold); color: var(--text-strong); }
    .day.done .day-km strong { color: var(--tone-good); }
    .mark { font-size: var(--font-2xs); color: var(--text-3); }
    .day.missed .mark { color: var(--tone-warn); font-weight: var(--weight-semibold); }

    .key {
        list-style: none;
        margin: 0 0 var(--space-4);
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }
    .key li { font-size: var(--font-xs); color: var(--text); }
    .key-type {
        margin-right: var(--space-2);
        font-weight: var(--weight-semibold);
        color: var(--text-strong);
        text-transform: capitalize;
    }

    .upcoming {
        margin-top: var(--space-5);
        padding-top: var(--space-4);
        border-top: 1px solid var(--border);
    }
    .upcoming h3 { margin: 0 0 var(--space-3); }
    .upcoming ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }
    .upcoming li {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        font-size: var(--font-xs);
        color: var(--text);
    }
    .week-date { flex: 1; color: var(--text-2); }
    .week-km { font-weight: var(--weight-semibold); color: var(--text-strong); font-variant-numeric: tabular-nums; }
    .week-long { min-width: 92px; text-align: right; color: var(--text-3); }
</style>
