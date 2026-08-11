<!--
    This week against its plan, plus what's coming.

    Progress is shown against the target without judgement mid-week — being at
    40% on a Wednesday is on pace, not behind, so the bar is informational and
    the recommendation engine is what decides whether a shortfall matters.
-->
<script>
    import { pct, shortDate, weekday } from "../lib/format.js";

    let { currentWeek = null, week = null, upcoming = [] } = $props();

    const progress = $derived(
        currentWeek?.targetKm > 0
            ? Math.min(100, (currentWeek.actualKm / currentWeek.targetKm) * 100)
            : null,
    );
    const longRunProgress = $derived(
        currentWeek?.longRunTargetKm > 0
            ? Math.min(100, (currentWeek.actualLongRunKm / currentWeek.longRunTargetKm) * 100)
            : null,
    );

    // A day is only "missed" once it's over. Today's session is still ahead of
    // you at 8am, and calling it missed would be both wrong and demoralising.
    function statusOf(day) {
        const planned = day.planned.filter((s) => s.isRun);
        const ran = day.actualKm > 0;
        if (planned.length === 0) return ran ? "extra" : "off";
        if (ran) return "done";
        return day.isPast ? "missed" : "ahead";
    }

    const days = $derived(
        (week?.days || []).map((day) => ({ ...day, status: statusOf(day) })),
    );
</script>

<section class="card">
    <h2>This week</h2>

    {#if !currentWeek}
        <p class="empty">No runs logged this week yet.</p>
    {:else}
        <div class="metric">
            <div class="metric-head">
                <span>Volume</span>
                <strong>
                    {currentWeek.actualKm.toFixed(1)} km
                    {#if currentWeek.targetKm}<span class="target">of {currentWeek.targetKm}</span>{/if}
                </strong>
            </div>
            {#if progress !== null}
                <div class="track"><div class="fill" style="width: {progress}%"></div></div>
            {:else if currentWeek.isPlanned}
                <p class="no-plan">A scheduled down week — no running planned.</p>
            {:else}
                <p class="no-plan">No target set for this week.</p>
            {/if}
        </div>

        <div class="metric">
            <div class="metric-head">
                <span>Long run</span>
                <strong>
                    {currentWeek.actualLongRunKm.toFixed(1)} km
                    {#if currentWeek.longRunTargetKm}<span class="target">of {currentWeek.longRunTargetKm}</span>{/if}
                </strong>
            </div>
            {#if longRunProgress !== null}
                <div class="track"><div class="fill" style="width: {longRunProgress}%"></div></div>
            {/if}
        </div>

        {#if days.length}
            <ol class="days">
                {#each days as day (day.date)}
                    <li class="day {day.status}" class:today={day.isToday}>
                        <span class="day-name">{weekday(day.date)}</span>
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
        {:else if currentWeek.keySessions?.length}
            <ul class="key">
                {#each currentWeek.keySessions as session}
                    <li>
                        <span class="key-type">{session.type || "key"}</span>
                        {session.detail || ""}
                    </li>
                {/each}
            </ul>
        {/if}

        <dl class="mini">
            <div><dt>Runs</dt><dd>{currentWeek.runs}</dd></div>
            <div><dt>Load</dt><dd>{Math.round(currentWeek.load)}</dd></div>
            <div><dt>Of target</dt><dd>{pct(currentWeek.volumePct)}</dd></div>
        </dl>
    {/if}

    {#if upcoming.length}
        <div class="upcoming">
            <h3>Coming up</h3>
            <ul>
                {#each upcoming as week (week.start)}
                    <li>
                        <span class="week-date">{shortDate(week.start)}</span>
                        <span class="week-km">{week.targetKm ? `${week.targetKm} km` : "—"}</span>
                        <span class="week-long">{week.longRunKm ? `${week.longRunKm} km long` : ""}</span>
                    </li>
                {/each}
            </ul>
        </div>
    {/if}
</section>

<style>
    h2 {
        font-family: var(--font-serif);
        font-size: var(--font-lg);
        font-weight: 600;
        color: var(--header-colour);
        margin: 0 0 var(--space-4) 0;
    }
    .metric { margin-bottom: var(--space-4); }
    .metric-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: var(--space-2);
    }
    .metric-head span {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--main-green);
    }
    .metric-head strong {
        font-family: var(--font-serif);
        font-size: var(--font-md);
        font-weight: 600;
        color: var(--header-colour);
    }
    .target {
        font-family: var(--font-sans);
        font-size: var(--font-2xs);
        font-weight: 400;
        text-transform: none;
        letter-spacing: 0;
        color: var(--paragraph-colour);
        opacity: 0.6;
        margin-left: var(--space-1);
    }
    .track {
        height: 6px;
        border-radius: var(--radius-pill);
        background: var(--inner-background);
        overflow: hidden;
    }
    .fill {
        height: 100%;
        background: var(--main-green);
        border-radius: var(--radius-pill);
        transition: width 0.3s ease;
    }
    .no-plan {
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.55;
        margin: 0;
    }

    .days {
        list-style: none;
        margin: 0 0 var(--space-4) 0;
        padding: 0;
        display: flex;
        flex-direction: column;
    }
    .day {
        display: grid;
        grid-template-columns: 34px 1fr auto;
        align-items: baseline;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-2);
        border-radius: var(--radius-sm, 4px);
        font-size: var(--font-xs);
        color: var(--paragraph-colour);
        border-left: 2px solid transparent;
    }
    .day.today {
        background: var(--main-green-translucent);
        border-left-color: var(--main-green);
    }
    /* Rest and strength days recede, but not so far that today disappears on
       the one week where today happens to be a rest day. */
    .day.off { opacity: 0.45; }
    .day.off.today { opacity: 0.8; }
    .day-name {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--main-green);
        font-weight: 600;
    }
    .day-plan {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }
    .session { display: flex; align-items: baseline; gap: var(--space-2); min-width: 0; }
    .session-type {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 600;
        color: var(--header-colour);
        opacity: 0.75;
        white-space: nowrap;
    }
    .session-detail {
        opacity: 0.65;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .day-km { font-family: var(--font-serif); text-align: right; white-space: nowrap; }
    .day-km strong { color: var(--main-green); font-weight: 600; }
    .day.extra .day-km strong { color: var(--header-colour); }
    .mark {
        font-family: var(--font-sans);
        font-size: var(--font-2xs);
        opacity: 0.5;
    }
    .day.missed .mark { color: var(--warning-colour, #b4652a); opacity: 0.9; }

    .key {
        list-style: none;
        margin: 0 0 var(--space-4) 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }
    .key li {
        font-size: var(--font-xs);
        color: var(--paragraph-colour);
        opacity: 0.85;
    }
    .key-type {
        display: inline-block;
        padding: 1px 7px;
        margin-right: var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--main-green-translucent);
        color: var(--main-green);
        font-size: var(--font-2xs);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    .mini {
        display: flex;
        gap: var(--space-5);
        margin: 0;
        padding-top: var(--space-3);
        border-top: 1px solid var(--main-green-translucent);
    }
    .mini div { display: flex; flex-direction: column; gap: 2px; }
    dt {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--main-green);
    }
    dd {
        margin: 0;
        font-family: var(--font-serif);
        font-weight: 600;
        color: var(--header-colour);
    }

    .upcoming {
        margin-top: var(--space-5);
        padding-top: var(--space-4);
        border-top: 1px solid var(--main-green-translucent);
    }
    h3 {
        font-size: var(--font-2xs);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--main-green);
        margin: 0 0 var(--space-3) 0;
    }
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
        color: var(--paragraph-colour);
    }
    .week-date { flex: 1; opacity: 0.75; }
    .week-km {
        font-family: var(--font-serif);
        font-weight: 600;
        color: var(--header-colour);
    }
    .week-long { opacity: 0.55; min-width: 92px; text-align: right; }

    .empty {
        font-size: var(--font-sm);
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin: 0;
    }
</style>
