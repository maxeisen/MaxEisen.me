<!--
    Reveal phase: the story itself — title, paragraphs, and woven-in illustrations
    — plus the show/hide toggle and round actions. Loads illustration blobs and
    drives the character-weighted auto-scroll from the shared narration store
    (the audio player lives in NarrationPlayer, rendered above this by HostScreen).
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
    /** @type {HTMLDivElement | null} */
    let storyScrollEl = $state(null);
    let followNarrationScroll = $state(true);
    let scrollSegments = null; // [{ start, chars, targetY }] in document coords
    let scrollTotalChars = 0;
    let scrollMaxY = 0;
    let scrollRaf = 0;
    let scrollResizeObserver = null;
    let resumeTimer = 0;

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

    // When narration starts playing, reveal the text and re-enable follow-scroll.
    let wasPlaying = false;
    $effect(() => {
        if (narration.playing && !wasPlaying) {
            storyTextVisible = true;
            followNarrationScroll = true;
        }
        wasPlaying = narration.playing;
    });

    function prefersReducedMotion() {
        return typeof window !== "undefined" && typeof window.matchMedia === "function"
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    // Per-narrated-segment scroll anchors (title + each paragraph), weighted by
    // character count and anchored to the real DOM positions. Narration speaks
    // only the text, so char-weighting keeps the scroll in step with the voice
    // and illustrations between paragraphs are simply scrolled past.
    function recomputeScrollGeom() {
        if (!storyScrollEl) { scrollSegments = null; return; }
        const vh = window.innerHeight;
        const docY = (el) => el.getBoundingClientRect().top + window.scrollY;
        const segs = [];
        const titleEl = storyScrollEl.parentElement?.querySelector(".story-title");
        if (titleEl) segs.push({ chars: Math.max(1, titleEl.textContent.length), targetY: 0 });
        for (const p of storyScrollEl.querySelectorAll(":scope > p")) {
            segs.push({ chars: Math.max(1, p.textContent.length), targetY: Math.max(0, docY(p) - vh * 0.3) });
        }
        if (!segs.length) { scrollSegments = null; return; }
        let acc = 0;
        for (const s of segs) { s.start = acc; acc += s.chars; }
        scrollTotalChars = acc;
        scrollMaxY = Math.max(0, document.documentElement.scrollHeight - vh);
        scrollSegments = segs;
    }

    // Desired scroll position for the current narration progress (char-weighted,
    // anchored to paragraph positions). null until geometry is ready.
    function currentScrollTarget() {
        if (!scrollSegments || !scrollTotalChars) return null;
        const d = narration.duration;
        if (!d || !Number.isFinite(d) || d <= 0) return null;
        const progress = Math.min(1, Math.max(0, narration.currentTime / d));
        const charPos = progress * scrollTotalChars;
        let i = 0;
        while (i < scrollSegments.length - 1 && charPos >= scrollSegments[i + 1].start) i++;
        const seg = scrollSegments[i];
        const f = Math.min(1, Math.max(0, (charPos - seg.start) / seg.chars));
        const nextY = scrollSegments[i + 1]?.targetY ?? scrollMaxY;
        return Math.min(scrollMaxY, seg.targetY + (nextY - seg.targetY) * f);
    }

    // One continuous loop while narration plays: each frame ease the page a
    // little toward the live target, capped per frame so it glides smoothly and
    // can never lurch/race (e.g. past a freshly-loaded image) — biased to trail.
    const SCROLL_EASE = 0.045;
    const SCROLL_MAX_STEP = 7; // px/frame ceiling (~420px/s) — above normal pace, gentle on transitions
    const RESUME_DELAY_MS = 5000; // after a manual scroll, drift back to following the narration
    function scrollFrame() {
        scrollRaf = 0;
        if (!followNarrationScroll || !storyTextVisible || !narration.playing || prefersReducedMotion()) return;
        if (!scrollSegments) recomputeScrollGeom();
        const target = currentScrollTarget();
        if (target != null) {
            const cur = window.scrollY;
            const delta = target - cur;
            if (Math.abs(delta) > 0.5) {
                const step = Math.max(-SCROLL_MAX_STEP, Math.min(SCROLL_MAX_STEP, delta * SCROLL_EASE));
                window.scrollTo(0, cur + step);
            }
        }
        scrollRaf = requestAnimationFrame(scrollFrame);
    }

    function onStoryScrollUser() {
        followNarrationScroll = false;
        if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = 0; }
        // Let the host scroll freely, then drift back to the narration's spot a
        // few seconds after they stop (each scroll resets the timer).
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => { followNarrationScroll = true; }, RESUME_DELAY_MS);
    }

    // Cache geometry; refresh on resize / lazy image load.
    $effect(() => {
        if (!storyScrollEl) return;
        recomputeScrollGeom();
        const onResize = () => recomputeScrollGeom();
        window.addEventListener("resize", onResize);
        if (typeof ResizeObserver !== "undefined") {
            scrollResizeObserver = new ResizeObserver(() => recomputeScrollGeom());
            scrollResizeObserver.observe(storyScrollEl);
        }
        return () => {
            window.removeEventListener("resize", onResize);
            scrollResizeObserver?.disconnect();
            scrollResizeObserver = null;
        };
    });

    // Start the scroll loop whenever narration is playing and we're following;
    // scrollFrame stops itself when any of those conditions drop.
    $effect(() => {
        const active = narration.playing && storyTextVisible && followNarrationScroll && storyScrollEl;
        if (active && !scrollRaf && !prefersReducedMotion()) {
            scrollRaf = requestAnimationFrame(scrollFrame);
        }
    });

    onDestroy(() => {
        releaseImages();
        cancelAnimationFrame(scrollRaf);
        clearTimeout(resumeTimer);
        scrollResizeObserver?.disconnect();
    });
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
        <div
            class="story-body"
            bind:this={storyScrollEl}
            onwheel={onStoryScrollUser}
            ontouchmove={onStoryScrollUser}
        >
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
