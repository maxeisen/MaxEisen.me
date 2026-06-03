<!-- Writing phase: per-player submission progress + the host's "weave" trigger. -->
<script>
    let {
        players = [],
        counts = { submitted: 0, total: 0 },
        error = null,
        busy = false,
        onGenerate,
    } = $props();
</script>

<section class="centered">
    <h2 class="display sm">Fill in the blanks on your phones…</h2>
    <div class="progress-big">{counts.submitted} / {counts.total} done</div>
    <ul class="chip-list">
        {#each players as p}
            <li class="chip {p.submitted ? 'done' : ''}">{p.name}{p.submitted ? " ✓" : "…"}</li>
        {/each}
    </ul>
    {#if error === "generation_failed"}
        <p class="error">The story machine choked. Try weaving again.</p>
    {/if}
    <button class="primary big" onclick={onGenerate} disabled={busy || counts.total === 0}>
        {busy ? "Weaving…" : counts.submitted < counts.total ? "Weave it anyway" : "Weave the story"}
    </button>
    <p class="hint">Waiting on stragglers? You can weave whenever you like.</p>
</section>
