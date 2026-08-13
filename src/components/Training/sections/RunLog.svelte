<!--
    The block's activity, newest first, with every run matched against the plan.

    "Recent runs" was the wrong name twice over: the list is scoped to the
    training block, and it says nothing about whether a run was the session the
    plan asked for. The match comes from the payload (see plan.js's
    matchRunsToPlan), so a run on a day with a planned session shows that
    session, and everything else is marked as an extra.

    Raw pace and GAP sit side by side so the elevation adjustment is visible
    rather than hidden inside one blended number — on a hilly run they diverge
    a lot, and that difference is the point.

    Rides appear as context and nothing more: they're the reason a week was
    quiet, not part of it. Every metric on the page ignores them (see
    metrics.js), so their row shows what they were rather than what they did.

    No route maps here: the payload deliberately carries no coordinates (see
    netlify/functions/_shared/training/shape.js), so each row links out to the
    activity on Strava for anyone who wants the map.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import { formatDistance, formatDuration, pace, shortDate, speed } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";
    import { stravaTag } from "../lib/runTags.js";

    let { runs = [], total = null } = $props();

    const plannedCount = $derived(runs.filter((r) => r.plan?.planned).length);
    const runCount = $derived(runs.filter((r) => r.sport !== "ride").length);
    const rideCount = $derived(runs.filter((r) => r.sport === "ride").length);

    // Why a ride's numbers don't show up anywhere else on the page. Worth
    // saying plainly on the row, because the alternative is a reader assuming
    // the model quietly took the cycling into account somewhere.
    const RIDE_NOTE =
        "Shown for context only. Cycling builds no running-specific durability, so rides count"
        + " towards nothing here — not weekly volume, fitness, fatigue or injury risk.";
</script>

<Card title="Recent activity" info={GLOSSARY.runs}>
    {#snippet aside()}
        {#if runs.length}
            <span class="count">
                {#if Number.isFinite(total) && total > runCount}
                    latest {runCount} of {total}
                {:else}
                    {runCount} runs
                {/if}
                · {plannedCount} planned
                {#if rideCount}· {rideCount} {rideCount === 1 ? "ride" : "rides"}{/if}
            </span>
        {/if}
    {/snippet}

    {#if runs.length === 0}
        <p class="card-empty">Nothing synced yet.</p>
    {:else}
        <ul class="log">
            {#each runs as run (run.id)}
                {@const isRide = run.sport === "ride"}
                {@const tag = stravaTag(run)}
                {@const planned = run.plan?.planned === true}
                {@const hilly = Number.isFinite(run.gapPaceSecPerKm)
                    && Math.abs(run.gapPaceSecPerKm - run.paceSecPerKm) > 5}
                <li>
                    <a
                        class="row"
                        class:extra={!planned && !isRide}
                        class:ride={isRide}
                        href="https://www.strava.com/activities/{run.id}"
                        target="_blank"
                        rel="noreferrer"
                    >
                        <div class="row-main">
                            <span class="row-name">{run.name}</span>
                            <span class="row-meta">
                                {shortDate(run.startDateLocal)}
                                {#if isRide}
                                    <span class="tag ride-tag" title={RIDE_NOTE}>ride</span>
                                {:else if planned}
                                    <span class="tag plan" title={run.plan.detail || ""}>
                                        {run.plan.type || "planned"}
                                    </span>
                                {:else}
                                    <span class="tag extra">extra</span>
                                {/if}
                                {#if tag && !isRide}<span class="tag">{tag}</span>{/if}
                                {#if run.averageHr}· {Math.round(run.averageHr)} bpm{/if}
                                {#if run.elevationGainM > 50}· {Math.round(run.elevationGainM)} m up{/if}
                            </span>
                        </div>

                        <div class="row-stat">
                            <strong>{formatDistance(run.distanceM)}</strong>
                            <span>{formatDuration(run.movingTimeSec)}{#if planned && run.plan.distanceKm}&nbsp;· {run.plan.distanceKm} km planned{/if}</span>
                        </div>

                        <div class="row-stat">
                            {#if isRide}
                                <!-- Minutes per kilometre is a runner's unit
                                     and reads as nonsense on a bike, so the
                                     column a run gives to pace and GAP gives
                                     the speed a cyclist would actually quote. -->
                                <strong>{speed(run.distanceM, run.movingTimeSec)}</strong>
                                <span>avg speed</span>
                            {:else}
                                <strong>{pace(run.paceSecPerKm)}</strong>
                                <span class:adjusted={hilly}>
                                    {Number.isFinite(run.gapPaceSecPerKm) ? `${pace(run.gapPaceSecPerKm)} GAP` : "—"}
                                </span>
                            {/if}
                        </div>
                    </a>
                </li>
            {/each}
        </ul>
    {/if}
</Card>

<style>
    .count {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.6;
    }

    .log {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        max-height: 560px;
        overflow-y: auto;
    }
    /* A hairline between rows as well as the gap: a two-line row on a phone
       otherwise runs straight into the next one's title. */
    .log li + li { border-top: 1px solid var(--main-green-translucent); padding-top: var(--space-2); }
    .row {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
        border-radius: var(--radius-sm);
        text-decoration: none;
        color: inherit;
        border-left: 2px solid var(--main-green);
        transition: background-color 0.15s ease;
    }
    /* Runs the plan didn't ask for still belong here, but shouldn't read with
       the same weight as the sessions that were the point of the week. */
    .row.extra { border-left-color: transparent; }
    /* A ride is context rather than training, so it sits a step back from even
       an unplanned run: dashed edge, and the whole row a touch quieter. */
    .row.ride { border-left-style: dashed; border-left-color: var(--paragraph-colour); opacity: 0.75; }
    .row:hover { background: var(--main-green-translucent); }

    .row-main { flex: 1; min-width: 0; }
    .row-name {
        display: block;
        font-family: var(--font-sans);
        font-size: var(--font-sm);
        font-weight: 600;
        color: var(--header-colour);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .row-meta {
        display: block;
        font-size: var(--font-2xs);
        line-height: 1.7;
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin-top: 3px;
    }
    /* The pill itself is a card convention; a row just needs it to breathe. */
    .tag { margin: 0 2px; }
    /* Its own tag rather than borrowing "extra", which already means a run the
       plan didn't ask for. A ride isn't a run at all. Local rather than a card
       convention because this is the only panel that shows one. */
    .tag.ride-tag {
        background: transparent;
        border: 1px dashed var(--paragraph-colour);
        color: var(--paragraph-colour);
        text-transform: lowercase;
        opacity: 0.9;
    }

    .row-stat {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        flex-shrink: 0;
        min-width: 82px;
        text-align: right;
    }
    .row-stat strong {
        font-family: var(--font-sans);
        font-size: var(--font-sm);
        font-weight: 600;
        color: var(--header-colour);
        line-height: 1.2;
    }
    .row-stat span {
        font-size: var(--font-2xs);
        color: var(--paragraph-colour);
        opacity: 0.65;
    }
    /* Highlight GAP only when it actually differs from raw pace — otherwise
       it's noise on a flat run. */
    .row-stat span.adjusted {
        color: var(--main-green);
        opacity: 1;
    }

    /* On a phone the two stat columns leave the run name barely 40px, which
       ellipses every title down to a word. Give the name the full width and
       drop the numbers onto a second line under it. */
    @media (max-width: 540px) {
        .log { gap: var(--space-3); }
        .log li + li { padding-top: var(--space-3); }
        .row {
            flex-wrap: wrap;
            justify-content: space-between;
            gap: var(--space-2) var(--space-4);
        }
        .row-main { flex-basis: 100%; }
        /* Distance/time to the left edge, pace/GAP to the right, on a line of
           their own under the name. */
        .row-stat {
            min-width: 0;
            align-items: flex-start;
            text-align: left;
        }
        .row-stat + .row-stat {
            align-items: flex-end;
            text-align: right;
        }
    }
</style>
