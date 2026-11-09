<!--
    The page- or panel-sized "loading" / "couldn't load" placeholder.

    Props
      error   message to show instead of the spinner
      fill    "page" (60vh) | "box" (fills a flex parent)
-->
<script>
    import Spinner from "./Spinner.svelte";

    let { error = "", fill = "page" } = $props();
</script>

<div class="load-state fill-{fill}" role="status" aria-live="polite" aria-busy={!error}>
    {#if error}
        <p>{error}</p>
    {:else}
        <Spinner size={fill === "page" ? 32 : 24} stroke={2} />
        <span class="sr-only">Loading</span>
    {/if}
</div>

<style>
    .load-state {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-2);
        font-size: var(--font-sm);
    }
    .fill-page { min-height: 60vh; }
    .fill-box { flex: 1; min-height: 0; }
    p { margin: 0; color: inherit; }
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
    }
</style>
