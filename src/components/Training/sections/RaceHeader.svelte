<!--
    Race countdown and the headline numbers: how long is left, what shape the
    training is in, and whether current fitness projects to the goal.
-->
<script>
    import { clock, km, pace, signed, signedClock } from "../lib/format.js";

    let { summary } = $props();

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
</script>

<header class="race-header">
    <div class="race-intro">
        <p class="eyebrow">Training for</p>
        <h1>{race.name || "Marathon"}</h1>
        <p class="race-date">{raceDate}</p>
    </div>

    {#if countdown}
        <div class="countdown">
            <span class="countdown-value">{countdown.value}</span>
            <span class="countdown-label">{countdown.label}</span>
        </div>
    {/if}
</header>

<div class="headline-stats">
    <div class="stat">
        <span class="stat-label">Goal</span>
        <strong class="stat-value">{clock(race.goalTimeSec)}</strong>
        <span class="stat-note">{pace(race.goalPaceSecPerKm)}</span>
    </div>

    <div class="stat">
        <span class="stat-label">Projected</span>
        <strong class="stat-value" class:ahead={prediction?.onTrack} class:behind={prediction && !prediction.onTrack}>
            {prediction ? clock(prediction.predictedSec) : "—"}
        </strong>
        <span class="stat-note">
            {prediction ? signedClock(prediction.deltaSec) : "needs a hard effort to project from"}
        </span>
    </div>

    <div class="stat">
        <span class="stat-label">Fitness</span>
        <strong class="stat-value">
            {latest ? Math.round(latest.ctl) : "—"}
            {#if trend}
                <span class="trend {trend.tone}">{trend.value}</span>
            {/if}
        </strong>
        <span class="stat-note">
            {#if latest}
                form {signed(latest.tsb, 0)}{trend ? ` · ${trend.note}` : ""}
            {:else}
                no data yet
            {/if}
        </span>
    </div>

    <div class="stat">
        <span class="stat-label">Block total</span>
        <strong class="stat-value">{km(summary?.totals?.distanceM)}</strong>
        <span class="stat-note">{summary?.totals?.runs || 0} runs</span>
    </div>
</div>

<style>
    .race-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--space-3) var(--space-5);
        flex-wrap: wrap;
        margin-bottom: var(--space-6);
    }
    .race-intro { min-width: 0; }
    .eyebrow {
        font-size: var(--font-2xs);
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--main-green);
        margin: 0 0 var(--space-2) 0;
    }
    h1 {
        font-family: var(--font-serif);
        font-size: clamp(2rem, 6vw, 3.2rem);
        font-weight: 700;
        letter-spacing: -0.03em;
        line-height: 1;
        color: var(--header-colour);
        margin: 0;
    }
    .race-date {
        font-size: var(--font-sm);
        color: var(--paragraph-colour);
        opacity: 0.75;
        margin: var(--space-2) 0 0 0;
    }

    /* The number and its label share a left edge. Right-aligning them against
       each other only looks deliberate while the countdown is opposite the
       race name; the moment it wraps underneath — which depends on how long
       the race is called, not on any one breakpoint — it leaves the number
       floating in from the margin with nothing to line up with. */
    .countdown {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1;
    }
    .countdown-value {
        font-family: var(--font-serif);
        font-size: clamp(2.5rem, 8vw, 4rem);
        font-weight: 700;
        letter-spacing: -0.04em;
        color: var(--main-green);
    }
    .countdown-label {
        font-size: var(--font-2xs);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--paragraph-colour);
        opacity: 0.7;
        margin-top: var(--space-2);
    }
    /* On a phone the countdown costs two lines of a short screen for one
       number; put it on one. */
    @media (max-width: 620px) {
        .countdown {
            flex-direction: row;
            align-items: baseline;
            gap: var(--space-2);
        }
        .countdown-value { font-size: 2.25rem; }
        .countdown-label { margin-top: 0; }
    }

    .headline-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--space-3);
        margin-bottom: var(--space-6);
    }
    .stat {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-4);
        border-radius: var(--radius-md);
        background: var(--inner-background);
        border: 1px solid var(--main-green-translucent);
    }
    .stat-label {
        font-size: var(--font-2xs);
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--main-green);
    }
    .stat-value {
        font-family: var(--font-serif);
        font-size: var(--font-xl);
        font-weight: 600;
        color: var(--header-colour);
        letter-spacing: -0.02em;
    }
    .stat-value.ahead { color: var(--tone-good); }
    .stat-value.behind { color: var(--tone-bad); }

    /* Sized and set apart from the figure it qualifies, so the eye still
       lands on the fitness number first. */
    .trend {
        font-family: var(--font-sans);
        font-size: var(--font-xs);
        font-weight: 600;
        letter-spacing: 0;
        vertical-align: 0.35em;
        margin-left: 2px;
    }
    .trend.up { color: var(--tone-good); }
    .trend.down { color: var(--tone-bad); }
    .trend.flat { color: var(--paragraph-colour); opacity: 0.6; }
    .stat-note {
        font-size: var(--font-xs);
        color: var(--paragraph-colour);
        opacity: 0.7;
    }
</style>
