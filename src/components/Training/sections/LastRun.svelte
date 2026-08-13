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
    in pace so there's nothing to translate anyway. It scrubs like the rest of
    the page's charts, which is where a single kilometre is legible at all.

    Heart rate goes under it on a second scale down the right-hand edge. Two
    units on one plot is a thing to do carefully, and it earns its place here
    because the divergence is the point: pace holding while the beats climb is
    drift, which the facts grid already reports as one number, and this is
    where in the run it happened. Grade-adjusted pace goes
    over it as a second line whenever the two actually diverge — on a hilly run
    that gap is the explanation for a slow kilometre, and on a flat one drawing
    it twice would just be noise.
-->
<script>
    import Card from "../../../lib/ui/Card.svelte";
    import ChartFrame from "../charts/ChartFrame.svelte";
    import { areaPath, linePath, niceScale, scaleLinear, smoothPath, xPct, yPct } from "../lib/chart.js";
    import { daysAgo, formatDistance, formatDuration, pace, pct, signed, timeTaken } from "../lib/format.js";
    import { GLOSSARY } from "../lib/glossary.js";
    import { stravaTag as tagFor } from "../lib/runTags.js";

    let { run = null } = $props();

    const WIDTH = 720;
    const HEIGHT = 150;

    // Strava reports running cadence one leg at a time; every watch and every
    // coach talks in steps per minute.
    const STEPS_PER_CYCLE = 2;

    // Below this the two pace lines are the same line with a wobble.
    const GAP_DIVERGENCE_SEC = 4;

    // Matching the server's thresholds (_shared/training/recovery.js), for the
    // same reason Recovery.svelte duplicates them: they're constants of the
    // model rather than of the data, and a panel disagreeing with the advice
    // about the same night is worse than either being wrong. Sleep gets its
    // own, because half an hour either way is a normal night and this is
    // asking whether the run cost you one.
    const RHR_RISE_BPM = 5;
    const HRV_DROP_PCT = 15;
    const SHORT_NIGHT_SEC = 30 * 60;

    const stravaTag = $derived(tagFor(run));

    const beatsShown = $derived.by(() => {
        if (!(run?.averageHr > 0)) return "—";
        const avg = Math.round(run.averageHr);
        return run.maxHr > 0 ? `${avg}/${Math.round(run.maxHr)}` : String(avg);
    });

    const splits = $derived((run?.splits || []).filter((s) => s.paceSecPerKm > 0));

    // Where along the run each reading was taken, and what it read.
    //
    // The stored trace when there is one — a hundred and twenty slices, fine
    // enough that an interval session looks like one. Splits when there isn't,
    // which is a manual entry or a run whose streams didn't come back: a
    // kilometre at a time, plotted at each kilometre's midpoint, because that
    // is the distance its average actually describes.
    const traced = $derived(Array.isArray(run?.trace?.m) && run.trace.m.length > 1);
    const samples = $derived.by(() => {
        if (traced) {
            const { m, pace: paces, hr } = run.trace;
            return m.map((metres, i) => ({
                m: metres,
                paceSecPerKm: paces[i] > 0 ? paces[i] : null,
                hr: hr[i] > 0 ? hr[i] : null,
            }));
        }
        return splits.map((s) => ({
            m: (s.km - 0.5) * 1000,
            paceSecPerKm: s.paceSecPerKm,
            hr: s.averageHr > 0 ? s.averageHr : null,
        }));
    });

    const span = $derived(Math.max(run?.distanceM || 0, samples.at(-1)?.m || 0));
    const atX = $derived((metres) => (span > 0 ? (metres / span) * WIDTH : 0));

    // Gridlines a runner reads without converting: quarters of a minute up to
    // a minute, then whole and half minutes.
    const PACE_STEPS = [15, 30, 60, 120, 300];

    const paces = $derived(samples.map((s) => s.paceSecPerKm).filter((p) => p > 0));
    const scale = $derived(
        niceScale([Math.min(...paces) - 8, Math.max(...paces) + 8], 4, { steps: PACE_STEPS }),
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

    // Contiguous stretches of measured points. A slice the watch couldn't pace
    // — standing at a crossing, a moment of lost signal — leaves a hole in the
    // line, rather than a straight segment drawn across it that would read as
    // running the whole way.
    function stretches(points) {
        const out = [];
        let current = [];
        for (const point of points) {
            if (point) current.push(point);
            else if (current.length > 1) { out.push(current); current = []; }
            else current = [];
        }
        if (current.length > 1) out.push(current);
        return out;
    }

    const paceLines = $derived(
        stretches(samples.map((s) => (s.paceSecPerKm > 0 ? { x: atX(s.m), y: y(s.paceSecPerKm) } : null))),
    );

    // The grade-adjusted line is a kilometre-resolution measure, so it's drawn
    // only on the kilometre-resolution chart. Over a trace it would invite
    // comparing a slice against the whole kilometre containing it, which is
    // the one comparison it can't support — and the run's grade adjustment is
    // in the facts below either way.
    const gapPoints = $derived(
        !traced && splits.length > 1 && splits.every((s) => s.gapPaceSecPerKm > 0)
            ? splits.map((s) => ({ x: atX((s.km - 0.5) * 1000), y: y(s.gapPaceSecPerKm) }))
            : [],
    );
    const showGap = $derived(
        gapPoints.length > 0
            && splits.some((s) => Math.abs(s.gapPaceSecPerKm - s.paceSecPerKm) >= GAP_DIVERGENCE_SEC),
    );

    const averageY = $derived(run?.paceSecPerKm > 0 ? y(run.paceSecPerKm) : null);

    // Heart rate along the same distance, on its own scale down the right.
    //
    // Two units on one plot is a thing to do carefully, and there are two
    // reasons it earns its place here. The chart already reads faster-is-higher,
    // so effort and pace rise together and the pair moves the way a runner
    // expects. And the divergence is the interesting part: pace flat while the
    // line beneath it climbs is drift, which the panel already reports as a
    // single number under "Drift" — this is where it happened.
    const beats = $derived(samples.map((s) => s.hr).filter((b) => b > 0));
    const hasHr = $derived(beats.length > 1);

    const hrScale = $derived.by(() => {
        if (!hasHr) return null;
        // Four ticks, not three. Three asks for a step so coarse it rounds a
        // run that lived between 130 and 175 out to an axis of 100 to 200, and
        // half the plot's height goes to heart rates nobody had.
        return niceScale([Math.min(...beats) - 4, Math.max(...beats) + 4], 4);
    });

    // Not flipped, unlike pace: more beats is more effort, and up is more.
    const hrY = $derived(hrScale ? scaleLinear([hrScale.min, hrScale.max], [HEIGHT, 0]) : null);
    const hrLines = $derived(
        hrScale
            ? stretches(samples.map((s) => (s.hr > 0 ? { x: atX(s.m), y: hrY(s.hr) } : null)))
            : [],
    );
    const hrTicks = $derived(
        hrScale
            ? hrScale.ticks.map((value) => ({
                    value,
                    label: String(Math.round(value)),
                    pct: ((value - hrScale.min) / (hrScale.max - hrScale.min)) * 100,
                }))
            : [],
    );

    // Kilometre marks, thinned to about half a dozen: a label per kilometre is
    // unreadable on a phone by about 8km.
    const tickStepKm = $derived(Math.max(1, Math.ceil(span / 1000 / 6)));
    const xTicks = $derived.by(() => {
        const out = [];
        for (let km = 0; km * 1000 <= span; km += tickStepKm) {
            out.push({
                key: km,
                label: String(km),
                pct: span > 0 ? ((km * 1000) / span) * 100 : 0,
                anchor: km === 0 ? "start" : "middle",
            });
        }
        return out;
    });

    // What the run was doing at a given point along it. The dots used to carry
    // a title attribute, which put the pace behind a hover delay and a browser
    // tooltip; this is the pair you'd actually compare — what it cost in pace,
    // and what your heart was doing for it.
    const scrub = $derived(
        samples
            .map((sample, i) => ({ sample, i }))
            .filter(({ sample }) => sample.paceSecPerKm > 0 || sample.hr > 0)
            .map(({ sample, i }) => ({
                key: sample.m,
                pct: xPct(atX(sample.m), WIDTH),
                label: traced ? `${(sample.m / 1000).toFixed(2)} km` : `Kilometre ${splits[i].km}`,
                readouts: [
                    ...(sample.paceSecPerKm > 0
                        ? [
                                {
                                    label: "Pace",
                                    value: pace(sample.paceSecPerKm),
                                    colour: "var(--main-green)",
                                    yPct: yPct(y(sample.paceSecPerKm), HEIGHT),
                                },
                            ]
                        : []),
                    ...(showGap && splits[i]?.gapPaceSecPerKm > 0
                        ? [
                                {
                                    label: "Grade adjusted",
                                    value: pace(splits[i].gapPaceSecPerKm),
                                    colour: "var(--paragraph-colour)",
                                    yPct: yPct(y(splits[i].gapPaceSecPerKm), HEIGHT),
                                },
                            ]
                        : []),
                    ...(sample.hr > 0
                        ? [
                                {
                                    label: "Heart rate",
                                    value: `${Math.round(sample.hr)} bpm`,
                                    colour: "var(--tone-bad)",
                                    yPct: hrY ? yPct(hrY(sample.hr), HEIGHT) : undefined,
                                },
                            ]
                        : []),
                ],
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

    // What the night afterwards looked like, when the ring has recorded one.
    // Fitness, fatigue and form above are all computed from the run itself, so
    // between them they can only say what the training log already knew. This
    // is the one line on the panel measured on the athlete rather than derived
    // from the session, and it's usually absent on the day of a run: the night
    // after this morning hasn't happened yet.
    // On the morning of a run the night after it hasn't happened, so the panel
    // falls back to the one you took into it: not what the run cost, but what
    // you had to spend on it.
    const night = $derived(run?.night || run?.nightBefore || null);
    const nightLabel = $derived(run?.night ? "The night after" : "Went into it on");

    const nightNotes = $derived.by(() => {
        if (!night) return [];
        const notes = [];
        if (Number.isFinite(night.sleep?.value)) {
            notes.push({
                key: "sleep",
                label: formatDuration(night.sleep.value),
                delta: minutes(night.sleep.delta),
                // Short is the direction worth colouring; a long night after a
                // hard run is the system working.
                bad: night.sleep.delta <= -SHORT_NIGHT_SEC,
            });
        }
        if (Number.isFinite(night.restingHr?.value)) {
            notes.push({
                key: "hr",
                label: `${Math.round(night.restingHr.value)} bpm resting`,
                delta: bpmDelta(night.restingHr.delta),
                bad: night.restingHr.delta >= RHR_RISE_BPM,
            });
        }
        if (Number.isFinite(night.hrv?.value)) {
            notes.push({
                key: "hrv",
                label: `${Math.round(night.hrv.value)} ms HRV`,
                delta: percent(night.hrv.deltaPct),
                bad: night.hrv.deltaPct <= -HRV_DROP_PCT,
            });
        }
        return notes;
    });

    // All three read "against your own normal", so the baseline is said once
    // in the label rather than three times in the numbers.
    function minutes(sec) {
        if (!Number.isFinite(sec) || Math.abs(sec) < 60) return null;
        return `${signed(sec / 60, 0)} min`;
    }
    function bpmDelta(bpm) {
        return Number.isFinite(bpm) && Math.abs(bpm) >= 1 ? signed(bpm, 0) : null;
    }
    function percent(value) {
        return Number.isFinite(value) && Math.abs(value) >= 5 ? `${signed(value, 0)}%` : null;
    }

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

    // A workout is meant to have uneven halves — intervals, then a jog home —
    // and the same is true of the drift between them. Both read as a verdict on
    // a steady run and as a description of a hard one.
    const steady = $derived(run?.effort !== "hard");

    const fade = $derived(run?.pacing?.fadePct ?? null);
    const pacingNote = $derived(fade === null ? null : (steady ? heldOrFaded(fade) : halves(fade)));

    function heldOrFaded(pct) {
        if (pct <= -2) return "negative split — the second half was quicker";
        if (pct < 2) return "even pace, start to finish";
        if (pct < 5) return `faded ${pct.toFixed(1)}% over the second half`;
        return `faded ${pct.toFixed(1)}% — the second half cost you`;
    }

    function halves(pct) {
        if (Math.abs(pct) < 2) return "even halves";
        const direction = pct > 0 ? "slower" : "quicker";
        return `second half ${Math.abs(pct).toFixed(1)}% ${direction}`;
    }

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
        // Drift measures how far pace-per-heartbeat slipped between the halves
        // of a run held at one effort. On an interval session it measures the
        // intervals, and 34% doesn't mean what it means on a long run — so it
        // sits out the ones it can't describe, as the efficiency trend does.
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
            <!-- "159 / bpm · 189 max" left the headline number unlabelled
                 beside three that say what they are, so the one figure on this
                 row that has a matching maximum was the one you had to infer
                 was a mean. The pair now reads off the caption in the order
                 it's written, and the caption fits on one line. -->
            <div class="stat">
                <strong>{beatsShown}</strong>
                <span>{run.maxHr && run.averageHr ? "average/max hr" : "average hr"}</span>
            </div>
        </div>

        {#if paceLines.length || hrLines.length}
            <div class="chart">
                <ChartFrame
                    height={HEIGHT}
                    {yTicks}
                    {xTicks}
                    {scrub}
                    rightTicks={hrTicks}
                    label="Pace{hasHr ? ' and heart rate' : ''} across the run"
                >
                    <svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none">
                        <!-- Filled and underneath, so that where it crosses the
                             pace line reads as one sitting above the other
                             rather than as the two being equal — which, on two
                             different scales, is a coincidence of axis choice
                             and means nothing at all. -->
                        {#each hrLines as line, i (i)}
                            <path class="hr-fill" d={areaPath(line, HEIGHT, { smooth: true })} />
                            <path class="hr" d={smoothPath(line)} />
                        {/each}
                        {#if averageY !== null}
                            <line class="average" x1="0" x2={WIDTH} y1={averageY} y2={averageY} />
                        {/if}
                        {#if showGap}
                            <path class="gap" d={linePath(gapPoints)} />
                        {/if}
                        {#each paceLines as line, i (i)}
                            <path class="line" d={smoothPath(line)} />
                        {/each}
                        <!-- Only where a point is a measurement in its own
                             right. On a trace they'd be a hundred and twenty
                             beads on a string. -->
                        {#if !traced}
                            {#each paceLines.flat() as point (point.x)}
                                <circle class="dot" cx={point.x} cy={point.y} r="4" />
                            {/each}
                        {/if}
                    </svg>
                </ChartFrame>
                <p class="legend">
                    <span>kilometre · faster is higher</span>
                    <!-- Swatch and label in one span: wrapped apart, a dash
                         sitting alone at the end of a line is just a dash. -->
                    {#if showGap}<span class="key"><span class="swatch"></span> grade adjusted</span>{/if}
                    {#if hasHr}<span class="key"><span class="swatch beats"></span> bpm, right</span>{/if}
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

                {#if nightNotes.length}
                    <p class="night">
                        <span class="night-label">{nightLabel}</span>
                        {#each nightNotes as note, i (note.key)}
                            <span class="night-note" class:bad={note.bad}>
                                {i > 0 ? "· " : ""}{note.label}
                                {#if note.delta}<span class="night-delta">{note.delta}</span>{/if}
                            </span>
                        {/each}
                        <span class="night-basis">against your own month</span>
                    </p>
                {/if}
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
    /* Deliberately the quieter of the two. The pair cross each other many
       times over an interval session, and two lines of equal weight crossing
       repeatedly is a thicket; heart rate reads as the band underneath and
       pace as the line on top of it. */
    .hr {
        fill: none;
        stroke: var(--tone-bad);
        stroke-width: 1.25;
        opacity: 0.5;
        vector-effect: non-scaling-stroke;
    }
    .hr-fill {
        fill: var(--tone-bad);
        opacity: 0.12;
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
    .swatch.beats {
        border-top-style: solid;
        border-top-color: var(--tone-bad);
        opacity: 0.65;
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

    /* The one line here measured on the body rather than derived from the run,
       so it's set apart from the deltas above it without becoming a fourth
       tile competing with fitness, fatigue and form. */
    .night {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: var(--space-3) 0 0;
        padding-top: var(--space-3);
        border-top: 1px solid var(--main-green-translucent);
        font-size: var(--font-xs);
        color: var(--paragraph-colour);
    }
    .night-label {
        font-size: var(--font-2xs);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--main-green);
    }
    .night-note { color: var(--header-colour); }
    .night-note.bad { color: var(--tone-warn); }
    .night-delta { opacity: 0.65; }
    .night-basis { opacity: 0.6; }

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
        /* Three deltas side by side leave room for "+0.3" and nothing else. */
        .changes { grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); }
    }
</style>
