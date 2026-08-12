<!--
    The last run, and what it did to the training.

    Every other panel here is a trend: twelve weeks of volume, a block of
    fitness, four weeks of intensity. None of them answer the question you
    actually have on the walk home — what that run was, and what it cost. This
    one is about a single session.

    Three parts, in the order you'd ask them in. What it was (the headline
    numbers). How it went (the kilometre-by-kilometre pace, and whether it held
    together). What it changed (fitness, fatigue and form, plus what it was
    worth against the week's target).

    The pace chart is drawn with a flipped y-axis so faster is higher, which is
    the only orientation people read without translating; the axis is labelled
    in pace so there's nothing to translate anyway. Grade-adjusted pace goes
    over it as a second line whenever the two actually diverge — on a hilly run
    that gap is the explanation for a slow kilometre, and on a flat one drawing
    it twice would just be noise.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import ChartFrame from "../charts/ChartFrame.svelte";
    import { linePath, niceScale, scaleLinear } from "../lib/chart.js";
    import { daysAgo, formatDistance, formatDuration, pace, pct, signed } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";

    let { run = null } = $props();

    const WIDTH = 720;
    const HEIGHT = 150;

    // Strava reports running cadence one leg at a time; every watch and every
    // coach talks in steps per minute.
    const STEPS_PER_CYCLE = 2;

    // Below this the two pace lines are the same line with a wobble.
    const GAP_DIVERGENCE_SEC = 4;

    // Strava's workout_type, as the run log reads it.
    const TAGS = { 1: "Race", 2: "Long run", 3: "Workout" };

    // And on the same terms as the log: Strava's label only earns space when
    // it says something the plan match doesn't. "long run · Long run" doesn't.
    const stravaTag = $derived.by(() => {
        const tag = TAGS[run?.workoutType];
        if (!tag) return null;
        const planType = run?.plan?.planned ? String(run.plan.type || "") : "";
        return tag.toLowerCase() === planType.toLowerCase() ? null : tag;
    });

    const splits = $derived((run?.splits || []).filter((s) => s.paceSecPerKm > 0));

    const scale = $derived(
        niceScale(
            [
                Math.min(...splits.map((s) => s.paceSecPerKm)) - 8,
                Math.max(...splits.map((s) => s.paceSecPerKm)) + 8,
            ],
            4,
        ),
    );

    // Pace runs the other way to every other axis on the page: the smallest
    // number is the best one, so it belongs at the top.
    const y = $derived(scaleLinear([scale.min, scale.max], [0, HEIGHT]));
    const yTicks = $derived(
        scale.ticks.map((value) => ({
            value,
            label: pace(value).replace("/km", ""),
            pct: 100 - ((value - scale.min) / (scale.max - scale.min)) * 100,
        })),
    );

    const step = $derived(splits.length > 1 ? WIDTH / (splits.length - 1) : 0);
    const pacePoints = $derived(splits.map((s, i) => ({ x: i * step, y: y(s.paceSecPerKm) })));
    const gapPoints = $derived(
        splits.every((s) => s.gapPaceSecPerKm > 0)
            ? splits.map((s, i) => ({ x: i * step, y: y(s.gapPaceSecPerKm) }))
            : [],
    );
    const showGap = $derived(
        gapPoints.length > 0
            && splits.some((s) => Math.abs(s.gapPaceSecPerKm - s.paceSecPerKm) >= GAP_DIVERGENCE_SEC),
    );

    const averageY = $derived(run?.paceSecPerKm > 0 ? y(run.paceSecPerKm) : null);

    // A number under every kilometre is unreadable on a phone, so thin them to
    // about half a dozen: both ends, then an even step in between, dropping
    // any that would crowd the last one.
    const tickStep = $derived(Math.max(1, Math.ceil(splits.length / 6)));
    const xTicks = $derived(
        splits
            .map((s, i) => ({ s, i }))
            .filter(({ i }) => {
                const last = splits.length - 1;
                if (i === 0 || i === last) return true;
                return i % tickStep === 0 && last - i >= tickStep;
            })
            .map(({ s, i }) => ({
                key: s.km,
                label: `${s.km}`,
                pct: (i / Math.max(1, splits.length - 1)) * 100,
                anchor: i === 0 ? "start" : i === splits.length - 1 ? "end" : "middle",
            })),
    );

    const form = $derived(run?.impact?.form || null);
    const load = $derived(run?.impact?.load || null);
    const week = $derived(run?.impact?.week || null);
    const planned = $derived(run?.plan?.planned === true);

    // Fitness and fatigue both rise from a run; the difference is that one is
    // what you keep. Colour the direction that's working for you.
    const changes = $derived(
        form
            ? [
                    { key: "fitness", label: "Fitness", value: form.ctl, delta: form.ctlDelta, good: form.ctlDelta > 0 },
                    { key: "fatigue", label: "Fatigue", value: form.atl, delta: form.atlDelta, good: form.atlDelta < 0 },
                    { key: "form", label: "Form", value: form.tsb, delta: form.tsbDelta, good: form.tsbDelta > 0 },
                ]
            : [],
    );

    /** How this run's load sat against the athlete's own recent median. */
    const relativeSize = $derived.by(() => {
        if (!(load?.vsTypicalPct > 0) || load.runsCompared < 3) return null;
        const ratio = load.vsTypicalPct;
        if (ratio >= 140) return "much bigger than usual for you";
        if (ratio >= 110) return "bigger than usual for you";
        if (ratio > 90) return "about your usual size";
        if (ratio > 60) return "smaller than usual for you";
        return "much smaller than usual for you";
    });

    /** "…and the hardest in three weeks", where that's true and worth saying. */
    const standout = $derived.by(() => {
        if (!load || !(load.load > 0) || load.runsCompared < 5) return null;
        if (load.daysSinceAsHard === null) return "the hardest run of the block so far";
        if (load.daysSinceAsHard < 7) return null;
        const weeks = Math.round(load.daysSinceAsHard / 7);
        return weeks === 1 ? "the hardest in a week" : `the hardest in ${weeks} weeks`;
    });

    const fade = $derived(run?.pacing?.fadePct ?? null);
    const pacingNote = $derived.by(() => {
        if (fade === null) return null;
        if (fade <= -2) return "negative split — the second half was quicker";
        if (fade < 2) return "even pace, start to finish";
        if (fade < 5) return `faded ${fade.toFixed(1)}% over the second half`;
        return `faded ${fade.toFixed(1)}% — the second half cost you`;
    });

    // Only what this run actually recorded: a facts grid with "—" in half of
    // its cells says less than a shorter grid.
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
        // Only worth its own cell on a run where the hills moved it; on a flat
        // one it's the average pace again, printed twice.
        if (Math.abs((run?.gapPaceSecPerKm ?? 0) - (run?.paceSecPerKm ?? 0)) >= GAP_DIVERGENCE_SEC) {
            list.push({ term: "Grade adjusted", value: pace(run.gapPaceSecPerKm) });
        }
        if (run?.averageCadence > 0) {
            list.push({ term: "Cadence", value: `${Math.round(run.averageCadence * STEPS_PER_CYCLE)} spm` });
        }
        if (Number.isFinite(run?.decouplingPct)) {
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

    // "An easy run", "a moderate run". Only ever applied to the three efforts,
    // so the first letter settles it.
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
        <p class="empty">Nothing synced yet.</p>
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
                <strong>{formatDuration(run.movingTimeSec)}</strong>
                <span>moving</span>
            </div>
            <div class="stat">
                <strong>{pace(run.paceSecPerKm)}</strong>
                <span>average pace</span>
            </div>
            <div class="stat">
                <strong>{run.averageHr ? `${Math.round(run.averageHr)}` : "—"}</strong>
                <span>{run.maxHr ? `bpm · ${Math.round(run.maxHr)} max` : "bpm average"}</span>
            </div>
        </div>

        {#if splits.length > 1}
            <div class="chart">
                <ChartFrame height={HEIGHT} {yTicks} {xTicks} label="Pace for each kilometre of the run">
                    <svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none">
                        {#if averageY !== null}
                            <line class="average" x1="0" x2={WIDTH} y1={averageY} y2={averageY} />
                        {/if}
                        {#if showGap}
                            <path class="gap" d={linePath(gapPoints)} />
                        {/if}
                        <path class="line" d={linePath(pacePoints)} />
                        {#each pacePoints as point, i}
                            <circle class="dot" cx={point.x} cy={point.y} r="4">
                                <title>km {splits[i].km} — {pace(splits[i].paceSecPerKm)}{splits[i].averageHr ? ` at ${Math.round(splits[i].averageHr)} bpm` : ""}</title>
                            </circle>
                        {/each}
                    </svg>
                </ChartFrame>
                <p class="legend">
                    <span>kilometre · faster is higher</span>
                    <!-- Swatch and label in one span: wrapped apart, a dash
                         sitting alone at the end of a line is just a dash. -->
                    {#if showGap}<span class="key"><span class="swatch"></span> grade adjusted</span>{/if}
                    {#if pacingNote}<span class="pacing">{pacingNote}</span>{/if}
                </p>
            </div>
        {/if}

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
        font-family: var(--font-serif);
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
    .tag {
        display: inline-block;
        padding: 1px 6px;
        border-radius: var(--radius-pill);
        background: var(--main-green-translucent);
        color: var(--main-green);
        font-weight: 600;
        letter-spacing: 0.04em;
    }
    .tag.plan {
        background: var(--tone-good-bg);
        color: var(--tone-good);
        text-transform: lowercase;
    }
    .tag.extra {
        background: transparent;
        border: 1px solid var(--main-green-translucent);
        color: var(--paragraph-colour);
        opacity: 0.8;
    }
    /* The effort a run turned out to be, which is not always the one it was
       meant to be — worth its own colour rather than another green pill. */
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
        font-family: var(--font-serif);
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

    .chart { margin-top: var(--space-5); }
    .line {
        fill: none;
        stroke: var(--main-green);
        stroke-width: 2;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
    }
    .dot {
        fill: var(--main-green);
        /* The line is stretched by the viewBox; a circle mustn't be. */
        vector-effect: non-scaling-stroke;
    }
    .gap {
        fill: none;
        stroke: var(--paragraph-colour);
        stroke-width: 1.5;
        stroke-dasharray: 4 4;
        opacity: 0.55;
        vector-effect: non-scaling-stroke;
    }
    .average {
        stroke: var(--header-colour);
        stroke-width: 1;
        stroke-dasharray: 2 5;
        opacity: 0.45;
        vector-effect: non-scaling-stroke;
    }
    .legend {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: var(--space-2) 0 0;
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--paragraph-colour);
        opacity: 0.55;
    }
    .key {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        white-space: nowrap;
    }
    .swatch {
        display: inline-block;
        width: 14px;
        height: 0;
        border-top: 1.5px dashed var(--paragraph-colour);
    }
    .pacing {
        padding-left: var(--space-2);
        border-left: 1px solid var(--main-green-translucent);
        text-transform: none;
        letter-spacing: 0;
        opacity: 0.9;
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
        font-family: var(--font-serif);
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
        font-family: var(--font-serif);
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

    .empty {
        font-size: var(--font-sm);
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin: 0;
    }

    @media (max-width: 540px) {
        /* Three deltas side by side leave room for "+0.3" and nothing else. */
        .changes { grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); }
    }
</style>
