<!-- Race countdown and the headline numbers, or just running between blocks. -->
<script>
    import PageHeader from "../../../lib/ui/PageHeader.svelte";
    import Stat from "../../../lib/ui/Stat.svelte";
    import { inBlock, lastRace as lastRaceOf, lastRaceLine } from "../lib/block.js";
    import { clock, clockMinutes, km, pace, pct, signed, signedClock } from "../../Activity/lib/format.js";

    let { summary } = $props();

    const event = $derived(inBlock(summary));
    const race = $derived(summary?.race || {});
    const prediction = $derived(summary?.prediction || null);
    const latest = $derived(summary?.latest || null);

    const countdown = $derived.by(() => {
        const days = summary?.daysToRace;
        if (!Number.isFinite(days)) return null;
        if (days < 0) return { value: "Done", label: "race day has passed" };
        if (days === 0) return { value: "Today", label: "race day" };
        return { value: String(days), label: days === 1 ? "day to go" : "days to go" };
    });

    // Fitness was the one headline number with nothing beside it, and it's the
    // one that needs the context most: 62 is a figure on an arbitrary scale,
    // and whether the block is still building is the part worth reading. A
    // gain of under a point over four weeks is flat — CTL moves in decimals
    // day to day, and "+0" dressed up as a rise would be noise.
    const trend = $derived.by(() => {
        const gain = latest?.ctlGain;
        if (!Number.isFinite(gain)) return null;
        if (Math.abs(gain) < 1) {
            return { value: "level", tone: "flat", note: "holding over 4 weeks" };
        }
        const rounded = Math.round(Math.abs(gain));
        return gain > 0
            ? { value: `+${rounded}`, tone: "up", note: `up ${rounded} in 4 weeks` }
            : { value: `−${rounded}`, tone: "down", note: `down ${rounded} in 4 weeks` };
    });

    const raceDate = $derived.by(() => {
        if (!race.date) return "";
        const d = new Date(`${race.date}T12:00:00Z`);
        return Number.isNaN(d.getTime())
            ? ""
            : d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    });

    // The plan file keeps its race after race day, so between blocks it's
    // the most recent one rather than a target.
    const lastRace = $derived(lastRaceLine(summary));
    const finished = $derived(lastRaceOf(summary));
</script>

{#snippet countdownAside()}
    {#if countdown}
        <div class="countdown">
            <span class="countdown-value">{countdown.value}</span>
            <span class="countdown-label">{countdown.label}</span>
        </div>
    {/if}
{/snippet}

{#if event}
    <PageHeader kicker="Training for" title={race.name || "Marathon"} subtitle={raceDate} aside={countdown ? countdownAside : null} />
{:else}
    <PageHeader kicker="Run log" title="Running" subtitle={lastRace ? `Last race: ${lastRace}` : null} />
{/if}

<!-- One ruled row of figures rather than a row of boxes: the numbers are
     the content, and a border around each one only competes with them. -->
<div class="headline-stats">
    {#if event}
        <Stat size="lg" label="Goal" value={clock(race.goalTimeSec)} note={pace(race.goalPaceSecPerKm)} />
        <Stat
            size="lg"
            label="Projected"
            value={prediction ? clockMinutes(prediction.predictedSec) : "—"}
            tone={prediction ? (prediction.onTrack ? "good" : "bad") : null}
            note={prediction?.range
                ? `${clockMinutes(prediction.range.fastSec)}–${clockMinutes(prediction.range.slowSec)}${prediction.deltaSec != null ? ` · ${signedClock(prediction.deltaSec)}` : ""}`
                : prediction
                    ? signedClock(prediction.deltaSec)
                    : "needs a few weeks of running to project from"}
        />
    {:else}
        {#if finished?.resultSec}
            <Stat
                size="lg"
                label={finished.isMarathon ? "Last marathon" : "Last race"}
                value={clock(finished.resultSec)}
                tone={finished.goalDeltaSec < 0 ? "good" : null}
                note={Number.isFinite(finished.goalDeltaSec) ? `${signedClock(finished.goalDeltaSec)} goal` : finished.dateLabel}
            />
        {/if}
        <Stat size="lg" label="Form" value={latest ? signed(latest.tsb, 0) : "—"} note={latest ? `fatigue ${Math.round(latest.atl)}` : "no data yet"} />
        <Stat size="lg" label="Easy" value={pct(summary?.intensity?.easyPct)} note="last 4 weeks" />
    {/if}

    <Stat
        size="lg"
        label="Fitness"
        note={!latest
            ? "no data yet"
            : event
                ? `form ${signed(latest.tsb, 0)}${trend ? ` · ${trend.note}` : ""}`
                : trend?.note ?? null}
    >
        {latest ? Math.round(latest.ctl) : "—"}
        {#if trend}<span class="trend {trend.tone}">{trend.value}</span>{/if}
    </Stat>

    <Stat size="lg" label={event ? "Block total" : "Logged"} value={km(summary?.totals?.distanceM)} note={`${summary?.totals?.runs || 0} runs`} />
</div>

<style>
    /* The number and its label share a left edge, so the countdown still
       lines up with something when it wraps under a long race name. */
    .countdown {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1;
    }
    .countdown-value {
        font-size: clamp(2.5rem, 7vw, 3.5rem);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.04em;
        color: var(--text-strong);
    }
    .countdown-label {
        margin-top: var(--space-2);
        font-size: var(--font-xs);
        color: var(--text-2);
    }
    @media (max-width: 620px) {
        .countdown { flex-direction: row; align-items: baseline; gap: var(--space-2); }
        .countdown-value { font-size: 2.25rem; }
        .countdown-label { margin-top: 0; }
    }

    .headline-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        margin-bottom: var(--space-6);
        border-top: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
    }
    .headline-stats > :global(.stat) {
        padding: var(--space-4) var(--space-4) var(--space-4) 0;
    }
    .headline-stats > :global(.stat + .stat) {
        padding-left: var(--space-4);
        border-left: 1px solid var(--border);
    }

    /* Smaller and set apart from the figure it qualifies, so the eye still
       lands on the fitness number first. */
    .trend {
        margin-left: 4px;
        font-size: var(--font-xs);
        font-weight: var(--weight-semibold);
        letter-spacing: 0;
        vertical-align: 0.4em;
    }
    .trend.up { color: var(--tone-good); }
    .trend.down { color: var(--tone-bad); }
    .trend.flat { color: var(--text-3); }

    @media (max-width: 700px) {
        .headline-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .headline-stats > :global(.stat) { padding: var(--space-3) var(--space-3) var(--space-3) 0; }
        .headline-stats > :global(.stat + .stat) { padding-left: var(--space-3); }
        .headline-stats > :global(.stat:nth-child(odd)) { padding-left: 0; border-left: 0; }
        .headline-stats > :global(.stat:nth-child(n + 3)) { border-top: 1px solid var(--border); }
    }
</style>
