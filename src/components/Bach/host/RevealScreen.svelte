<!--
    Reveal phase: the story itself — title, paragraphs, and woven-in illustrations
    — plus the show/hide toggle and round actions. Loads illustration blobs. The
    host scrolls the story manually (no auto-scroll). The audio player lives in
    NarrationPlayer, rendered above this by HostScreen.
-->
<script>
    import { onDestroy } from "svelte";
    import * as api from "../lib/api.js";
    import { formatStory, buildStoryBlocks } from "../lib/story.js";
    import { narration } from "../lib/narration.svelte.js";

    let { code, password, gameState, busy = false, onGenerate, onOpenVoting, onRequestImages } = $props();

    const storyText = $derived(gameState?.story || "");
    const story = $derived(formatStory(storyText));
    const imagePlacements = $derived(gameState?.storyImagePlacements ?? []);

    /** @type {Record<number, string>} */
    let imageUrls = $state({});
    let imagesLoading = $state(false);
    const storyBlocks = $derived(buildStoryBlocks(story.paragraphs, imagePlacements, imageUrls));

    let storyTextVisible = $state(false);

    async function loadStoryImages(placements, readyIds) {
        const round = gameState?.roundIndex ?? -1;
        if (!password || !code || round < 0 || !placements.length || !readyIds?.length) return;
        imagesLoading = true;
        try {
            const next = { ...imageUrls };
            for (const slot of placements) {
                const id = Number(slot.id);
                if (next[id] || !readyIds.includes(id)) continue;
                const { ok, blob } = await api.fetchStoryImage(password, code, round, id);
                if (ok && blob) next[id] = URL.createObjectURL(blob);
            }
            imageUrls = next;
        } finally {
            imagesLoading = false;
        }
    }

    function releaseImages() {
        for (const url of Object.values(imageUrls)) URL.revokeObjectURL(url);
        imageUrls = {};
    }

    // Fetch illustration blobs as the server reports them ready (poll grows readyImageIds).
    $effect(() => {
        const placements = gameState?.storyImagePlacements ?? [];
        const readyIds = gameState?.readyImageIds ?? [];
        if (!placements.length || gameState?.imagesPending || imagesLoading || !readyIds.length) return;
        if (readyIds.some((id) => !imageUrls[id])) void loadStoryImages(placements, readyIds);
    });

    // Reveal the text the first time narration starts (the host scrolls it themselves).
    let wasPlaying = false;
    $effect(() => {
        if (narration.playing && !wasPlaying) storyTextVisible = true;
        wasPlaying = narration.playing;
    });

    onDestroy(releaseImages);
</script>

<section class="reveal">
    {#if gameState?.imagesError}
        <p class="error narration-status">
            {gameState.imagesError === "images_partial" ? "Some illustrations didn't finish." : "Illustrations didn't generate."}
            <button type="button" class="ghost small" onclick={() => onRequestImages?.(true)} disabled={busy}>Retry illustrations</button>
        </p>
    {/if}

    <div class="story-reveal-controls">
        {#if storyTextVisible}
            <button type="button" class="ghost story-reveal-btn" onclick={() => (storyTextVisible = false)}>Hide story text</button>
        {:else}
            <button type="button" class="primary story-reveal-btn" onclick={() => (storyTextVisible = true)}>Show the story</button>
        {/if}
    </div>

    {#if storyTextVisible}
        {#if story.title}<h2 class="story-title">{story.title}</h2>{/if}
        <div class="story-body">
            {#each storyBlocks as block}
                {#if block.type === "paragraph"}
                    <p>{@html block.html}</p>
                {:else}
                    <figure class="story-illustration">
                        {#if block.url}
                            <img src={block.url} alt={block.caption || "Story moment"} loading="lazy" />
                        {:else if gameState?.imagesPending}
                            <div class="story-img-placeholder" aria-hidden="true">Drawing this moment…</div>
                        {:else}
                            <div class="story-img-placeholder missed" aria-hidden="true">Illustration unavailable</div>
                        {/if}
                        {#if block.caption}
                            <figcaption>{block.caption}</figcaption>
                        {/if}
                    </figure>
                {/if}
            {/each}
        </div>
    {/if}

    <div class="reveal-actions">
        <button class="ghost" onclick={() => { storyTextVisible = false; onGenerate(); }} disabled={busy}>↻ Regenerate</button>
        <button class="primary" onclick={onOpenVoting} disabled={busy}>Open MVP voting →</button>
    </div>
</section>
