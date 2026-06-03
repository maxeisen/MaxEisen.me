<!-- Generating phase: story is being written; host can cancel back to writing. -->
<script>
    let { busy = false, onAbort } = $props();
</script>

<section class="centered">
    <div class="spinner"></div>
    <h2 class="display sm">Writing your story…</h2>
    <p class="muted">Almost there — narration and funny scene illustrations are on the way.</p>
    <button class="ghost" style="margin-top: 1rem" onclick={onAbort} disabled={busy}>
        Cancel and go back
    </button>
</section>
