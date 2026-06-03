<!-- Generic "watch the big screen" status card (emoji/spinner + title + sub). -->
<script>
    let { emoji = "", title = "", sub = "", spinner = false } = $props();
</script>

<div class="card center">
    {#if spinner}<div class="spinner"></div>{/if}
    {#if emoji}<div class="big-emoji">{emoji}</div>{/if}
    {#if title}<h1 class="title">{title}</h1>{/if}
    {#if sub}<p class="sub">{sub}</p>{/if}
</div>
