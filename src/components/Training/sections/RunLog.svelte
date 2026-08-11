<!--
    Recent runs.

    Raw pace and GAP sit side by side so the elevation adjustment is visible
    rather than hidden inside one blended number — on a hilly run they diverge
    a lot, and that difference is the point.

    No route maps here: the payload deliberately carries no coordinates (see
    netlify/functions/_shared/training/shape.js), so each row links out to the
    activity on Strava for anyone who wants the map.
-->
<script>
    import { formatDistance, formatDuration, pace, shortDate } from "../lib/format.js";

    let { runs = [] } = $props();

    // Strava's workout_type on a run: 1 race, 2 long run, 3 workout.
    const TAGS = { 1: "Race", 2: "Long run", 3: "Workout" };
</script>

<section class="card">
    <div class="card-head">
        <h2>Recent runs</h2>
        <span class="count">{runs.length}</span>
    </div>

    {#if runs.length === 0}
        <p class="empty">Nothing synced yet.</p>
    {:else}
        <ul class="log">
            {#each runs as run (run.id)}
                {@const tag = TAGS[run.workoutType]}
                {@const hilly = Number.isFinite(run.gapPaceSecPerKm)
                    && Math.abs(run.gapPaceSecPerKm - run.paceSecPerKm) > 5}
                <li>
                    <a
                        class="row"
                        href="https://www.strava.com/activities/{run.id}"
                        target="_blank"
                        rel="noreferrer"
                    >
                        <div class="row-main">
                            <span class="row-name">{run.name}</span>
                            <span class="row-meta">
                                {shortDate(run.startDateLocal)}
                                {#if tag}<span class="tag">{tag}</span>{/if}
                                {#if run.averageHr}· {Math.round(run.averageHr)} bpm{/if}
                                {#if run.elevationGainM > 50}· {Math.round(run.elevationGainM)} m up{/if}
                            </span>
                        </div>

                        <div class="row-stat">
                            <strong>{formatDistance(run.distanceM)}</strong>
                            <span>{formatDuration(run.movingTimeSec)}</span>
                        </div>

                        <div class="row-stat">
                            <strong>{pace(run.paceSecPerKm)}</strong>
                            <span class:adjusted={hilly}>
                                {Number.isFinite(run.gapPaceSecPerKm) ? `${pace(run.gapPaceSecPerKm)} GAP` : "—"}
                            </span>
                        </div>
                    </a>
                </li>
            {/each}
        </ul>
    {/if}
</section>

<style>
    .card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: var(--space-3);
    }
    h2 {
        font-family: var(--font-serif);
        font-size: var(--font-lg);
        font-weight: 600;
        color: var(--header-colour);
        margin: 0;
    }
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
        max-height: 520px;
        overflow-y: auto;
    }
    .row {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-3);
        border-radius: var(--radius-sm);
        text-decoration: none;
        color: inherit;
        transition: background-color 0.15s ease;
    }
    .row:hover { background: var(--main-green-translucent); }

    .row-main { flex: 1; min-width: 0; }
    .row-name {
        display: block;
        font-family: var(--font-serif);
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
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin-top: 2px;
    }
    .tag {
        display: inline-block;
        padding: 1px 6px;
        margin: 0 2px;
        border-radius: var(--radius-pill);
        background: var(--main-green-translucent);
        color: var(--main-green);
        font-weight: 600;
        letter-spacing: 0.04em;
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
        font-family: var(--font-serif);
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

    .empty {
        font-size: var(--font-sm);
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin: 0;
    }
</style>
