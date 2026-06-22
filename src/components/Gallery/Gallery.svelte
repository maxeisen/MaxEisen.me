<!--
    Reusable gallery interface. Routes pass props to configure tag /
    sort / gating / upload, plus an `intro` snippet for the About copy.

    Adding a new gallery (e.g. /gallery/trip) is a ~15-line route file
    that imports this component and passes its own props + snippet.
-->
<script>
    import { onMount } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import PasswordGate from "./PasswordGate.svelte";
    import UploadZone from "./UploadZone.svelte";
    import MasonryGrid from "./MasonryGrid.svelte";
    import Lightbox from "./Lightbox.svelte";
    import Slideshow from "./Slideshow.svelte";
    import { downloadPhotos, downloadOne } from "./lib/download.js";
    import BackLink from "../../lib/ui/BackLink.svelte";
    import { fetchJson, FetchError } from "../../lib/data/fetchJson.js";

    let {
        /** Cloudinary tag to fetch. */
        tag,
        /** Title for the <h1>. */
        title = "Gallery",
        /** "date-desc" | "captured-asc" | "random" — ordering applied client-side after fetch. */
        sort = "random",
        /** When set, this turns on the PasswordGate AND sends the password
            header on /.netlify/functions/galleryList. The value is also the
            scope used by the gate + signing function. */
        passwordScope = null,
        /** Show the drag-and-drop upload zone once authenticated. */
        uploadEnabled = false,
        /** Enable bulk-select + download. Replaces the slideshow button
            with Cancel/Download while a selection is active. */
        bulkDownloadEnabled = false,
        /** Private gallery: photos are authenticated-delivery in Cloudinary
            and can't be reached by URL alone. Fetch from signedGalleryList
            (password-gated, server-signs every URL locally in one call) so
            the photos arrive carrying pre-signed thumb/full/download URLs.
            Without the password the function returns nothing and the images
            aren't publicly fetchable — the password is a real gate, not just
            a UI veil. */
        signed = false,
        /** Show "(N of)" inside the intro slot — opt-in. */
        showCount = false,
        /** Intro snippet — fully arbitrary About markup. */
        intro,
    } = $props();

    let photos = $state([]);
    let loading = $state(true);
    let error = $state("");
    let introOpen = $state(true);
    let password = $state(passwordScope ? null : ""); // empty string = "no gate needed"
    let lightboxOpen = $state(false);
    let lightboxIndex = $state(0);
    let slideshowOpen = $state(false);

    // Bulk-download selection state. SvelteSet is reactive on mutation.
    let selectionMode = $state(false);
    const selectedIds = new SvelteSet();
    let downloading = $state(false);
    let downloadProgress = $state(null); // { done, total } | null

    function toggleSelectionMode() {
        selectionMode = !selectionMode;
        if (!selectionMode) selectedIds.clear();
    }

    function toggleSelected(originalIdx) {
        const id = photos[originalIdx]?.public_id;
        if (!id) return;
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
    }

    // Used by MasonryGrid's drag-to-select: it tells us "set photo N to
    // state X" rather than toggling, so the painted state is deterministic
    // across the entire drag path.
    function setSelected(originalIdx, selected) {
        const id = photos[originalIdx]?.public_id;
        if (!id) return;
        if (selected) selectedIds.add(id);
        else selectedIds.delete(id);
    }

    const allSelected = $derived(photos.length > 0 && selectedIds.size === photos.length);

    function toggleAll() {
        if (allSelected) {
            selectedIds.clear();
        } else {
            for (const p of photos) selectedIds.add(p.public_id);
        }
    }

    async function runDownload() {
        if (selectedIds.size === 0 || downloading) return;
        downloading = true;
        downloadProgress = { done: 0, total: selectedIds.size };
        const picked = photos.filter((p) => selectedIds.has(p.public_id));
        try {
            await downloadPhotos(picked, {
                zipName: `${tag}-photos`,
                onProgress: (done, total) => { downloadProgress = { done, total }; },
            });
            // Exit selection mode after a successful save.
            selectionMode = false;
            selectedIds.clear();
        } catch (err) {
            console.error("Download failed:", err);
            error = "Couldn't download those photos. Try again?";
        } finally {
            downloading = false;
            downloadProgress = null;
        }
    }

    // Persist intro open/close across visits so collapsed stays collapsed.
    const INTRO_KEY = `gallery-intro-open:${tag}`;

    function sortPhotos(arr) {
        const next = [...arr];
        if (sort === "date-desc") {
            next.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        } else if (sort === "captured-asc") {
            // Chronological by capture time (EXIF), oldest first — walks the
            // day in order. Falls back to upload time when a photo lacks EXIF.
            next.sort((a, b) =>
                (a.captured_at || a.created_at || "").localeCompare(b.captured_at || b.created_at || ""),
            );
        } else if (sort === "random") {
            for (let i = next.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [next[i], next[j]] = [next[j], next[i]];
            }
        }
        return next;
    }

    async function fetchPhotos() {
        loading = true;
        error = "";
        try {
            // Private galleries get signed URLs from signedGalleryList; public
            // ones get plain public_ids from galleryList (URLs built client-side).
            const fn = signed ? "signedGalleryList" : "galleryList";
            const url = `/.netlify/functions/${fn}?tag=${encodeURIComponent(tag)}`;
            const headers = passwordScope && password ? { "X-Gallery-Password": password } : {};
            const data = await fetchJson(url, { headers });
            photos = sortPhotos(data.resources || []);
        } catch (e) {
            if (e instanceof FetchError && e.status === 401) {
                // Stored password no longer valid — clear it and re-show the gate.
                if (passwordScope) {
                    try { sessionStorage.removeItem(`galleryPassword:${passwordScope}`); } catch {}
                    password = null;
                }
                return;
            }
            error = e instanceof FetchError
                ? "Couldn't load photos right now."
                : "Network error loading photos.";
        } finally {
            loading = false;
        }
    }

    function open(idx) {
        lightboxIndex = idx;
        lightboxOpen = true;
    }

    function onIntroToggle(e) {
        try { localStorage.setItem(INTRO_KEY, String(e.currentTarget.open)); } catch {}
    }

    onMount(() => {
        try {
            const saved = localStorage.getItem(INTRO_KEY);
            if (saved !== null) introOpen = saved === "true";
        } catch {}
        document.body.classList.add("gallery-page");
        return () => document.body.classList.remove("gallery-page");
    });

    // Refetch whenever we get a valid password (or on first mount with no gate).
    $effect(() => {
        if (passwordScope && !password) return; // gate still closed
        fetchPhotos();
    });

    function onUploaded() {
        // Re-fetch in-place instead of a hard reload — keeps the lightbox state.
        fetchPhotos();
    }
</script>

{#if passwordScope}
    <PasswordGate
        scope={passwordScope}
        bind:password
        title={title}
        hint="Friends-only gallery."
    />
{/if}

<BackLink />

{#if photos.length > 0}
    <div class="top-actions">
        {#if selectionMode}
            <button class="action-link cancel" type="button" onclick={toggleSelectionMode} disabled={downloading} aria-label="Cancel selection">
                <span class="action-link-text">cancel</span>
                <svg class="action-link-icon" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
            </button>
            <button
                class="action-link select-all"
                type="button"
                onclick={toggleAll}
                disabled={downloading}
                aria-label={allSelected ? "Deselect all" : "Select all"}
                aria-pressed={allSelected ? "true" : "false"}
            >
                <span class="action-link-text">{allSelected ? "none" : "all"}</span>
                <svg class="action-link-icon" viewBox="0 0 16 16" aria-hidden="true">
                    {#if allSelected}
                        <rect x="3" y="3" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/>
                    {:else}
                        <rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/>
                        <path d="M5.5 8 L7.5 10 L11 6.5" fill="none" stroke="var(--background-one, #1c1a17)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                    {/if}
                </svg>
            </button>
            <button
                class="action-link download primary"
                type="button"
                onclick={runDownload}
                disabled={selectedIds.size === 0 || downloading}
                aria-label={downloadProgress ? `Downloading ${downloadProgress.done} of ${downloadProgress.total}` : `Download ${selectedIds.size} photos`}
            >
                <span class="action-link-text">
                    {#if downloading && downloadProgress}
                        downloading {downloadProgress.done}/{downloadProgress.total}…
                    {:else if downloading}
                        downloading…
                    {:else}
                        download ({selectedIds.size})
                    {/if}
                </span>
                <svg class="action-link-icon" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M8 2 L8 11 M4 7.5 L8 11.5 L12 7.5 M3 14 L13 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        {:else}
            <button class="action-link" type="button" onclick={() => (slideshowOpen = true)} aria-label="Start slideshow">
                <span class="action-link-text">slideshow</span>
                <svg class="action-link-icon" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M5 4 L14 8 L5 12 Z" fill="currentColor"/>
                </svg>
            </button>
            {#if bulkDownloadEnabled}
                <button class="action-link" type="button" onclick={toggleSelectionMode} aria-label="Select photos to download">
                    <span class="action-link-text">select</span>
                    <svg class="action-link-icon" viewBox="0 0 16 16" aria-hidden="true">
                        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/>
                        <path d="M5 8 L7 10 L11 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            {/if}
        {/if}
    </div>
{/if}

<main class="container">
    <header class="gallery-header">
        <h1>{title}</h1>
    </header>

    {#if intro}
        <details class="gallery-intro" open={introOpen} ontoggle={onIntroToggle}>
            <summary>About this gallery</summary>
            <div class="gallery-intro-body">
                {@render intro({ count: showCount ? photos.length : null })}
                {#if uploadEnabled || bulkDownloadEnabled}
                    <p class="gallery-intro-features">
                        {#if uploadEnabled}
                            <strong>Uploading:</strong> drag photos onto the <a href="#upload-zone" class="intro-anchor">zone below the grid</a>, or tap <em>pick files</em>. We ask for your name once so uploads land tagged to you.
                        {/if}
                        {#if uploadEnabled && bulkDownloadEnabled}<br/>{/if}
                        {#if bulkDownloadEnabled}
                            <strong>Downloading:</strong> tap the arrow on any photo (or inside the lightbox) for a single download. To grab a batch, hit <em>select</em> top-right, tap photos to choose them — or drag your cursor / finger across to paint-select many at once — and <em>download</em>. Download format depends on number of photos selected.
                        {/if}
                    </p>
                {/if}
            </div>
        </details>
    {/if}

    {#if loading && !photos.length}
        <div class="empty-state">Loading photos…</div>
    {:else if error}
        <div class="empty-state">{error}</div>
    {:else if !photos.length}
        <div class="empty-state">No photos yet.</div>
    {:else}
        <MasonryGrid
            {photos}
            onopen={open}
            {selectionMode}
            {selectedIds}
            ontoggle={toggleSelected}
            onset={setSelected}
            downloadEnabled={bulkDownloadEnabled}
            ondownload={(idx) => downloadOne(photos[idx])}
        />
    {/if}

    {#if uploadEnabled && passwordScope && password}
        <!-- id is the anchor target for the intro blurb's "zone below the
             grid" link, plus scroll-margin so the browser scrolls past the
             fixed top toolbar instead of tucking the dashed border under it. -->
        <div id="upload-zone" class="upload-zone-anchor">
            <UploadZone
                scope={passwordScope}
                {password}
                onuploaded={onUploaded}
                onauthfail={() => { password = null; }}
            />
        </div>
    {/if}

    {#if photos.length > 0}
        <footer class="gallery-count">{photos.length} photo{photos.length === 1 ? "" : "s"}</footer>
    {/if}
</main>

<Lightbox
    {photos}
    bind:open={lightboxOpen}
    bind:index={lightboxIndex}
    downloadEnabled={bulkDownloadEnabled}
/>
<Slideshow {photos} bind:open={slideshowOpen} />

<style>
    /* The page background drift is scoped to body.gallery-page so it
       doesn't bleed onto the SPA homepage. The class is added/removed in
       onMount/onDestroy. */
    :global(body.gallery-page) {
        font-family: 'Inter', sans-serif;
        font-weight: 300;
        line-height: 1.4;
        color: var(--paragraph-colour);
        background-color: var(--background-one);
        background-image:
            radial-gradient(circle at 50% 50%, var(--background-glow) 0%, transparent 45%),
            radial-gradient(circle at 50% 50%, var(--background-accent) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, var(--background-two) 0%, transparent 55%),
            radial-gradient(circle at 50% 50%, var(--background-two) 0%, transparent 60%);
        background-size: 180% 180%, 200% 200%, 220% 220%, 270% 270%;
        background-repeat: no-repeat;
        background-attachment: fixed;
        animation: gradient 25s ease-in-out infinite; /* keyframe in global.css */
    }
    @media (prefers-reduced-motion: reduce) {
        :global(body.gallery-page) { animation: none; }
    }

    .container {
        max-width: 1600px;
        margin: 0 auto;
        padding: 3rem 1.5rem 4rem;
    }

    .gallery-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 2.5rem;
        gap: 1rem;
    }

    h1 {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-optical-sizing: auto;
        font-size: clamp(2rem, 4vw, 3.5rem);
        letter-spacing: -0.03em;
        margin: 0;
        color: var(--header-colour);
    }

    .gallery-intro {
        max-width: 60ch;
        margin: -1.25rem 0 2.5rem 0;
        font-size: 0.95rem;
        color: var(--paragraph-colour);
    }
    .gallery-intro :global(summary) {
        list-style: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--main-green);
        opacity: 0.65;
        user-select: none;
        transition: opacity 0.2s ease;
    }
    .gallery-intro :global(summary::-webkit-details-marker) { display: none; }
    .gallery-intro :global(summary:hover),
    .gallery-intro :global(summary:focus-visible) { opacity: 1; outline: none; }
    .gallery-intro :global(summary::after) {
        content: '▾';
        font-size: 0.65rem;
        line-height: 1;
        transition: transform 0.2s ease;
    }
    .gallery-intro[open] :global(summary::after) { transform: rotate(180deg); }
    .gallery-intro-body {
        margin-top: 0.65rem;
        line-height: 1.55;
        opacity: 0.78;
    }
    .gallery-intro-body :global(p) { margin: 0 0 0.7rem 0; }
    .gallery-intro-body :global(p:last-child) { margin-bottom: 0; }
    .gallery-intro-body :global(a) {
        color: var(--main-green);
        text-decoration: none;
        border-bottom: 1px solid var(--main-green-translucent);
        transition: border-color 0.2s ease;
    }
    .gallery-intro-body :global(a:hover) { border-bottom-color: var(--main-green); }

    /* Help blurb that surfaces when the gallery has upload or download
       features enabled — sits visually distinct from the user-supplied
       intro copy so it reads as instructions, not narrative. */
    .gallery-intro-features {
        margin-top: 0.9rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--main-green-translucent);
        font-size: 0.88rem;
        line-height: 1.55;
        opacity: 0.78;
    }
    .gallery-intro-features strong {
        color: var(--main-green);
        font-weight: 600;
    }
    .gallery-intro-features em {
        font-style: normal;
        font-weight: 600;
        color: var(--header-colour);
    }
    /* Smooth scroll for the in-page "jump to upload zone" link. Scoped
       to the gallery page so it doesn't change scroll behavior elsewhere. */
    :global(body.gallery-page) { scroll-behavior: smooth; }
    /* scroll-margin pushes the target away from any fixed top chrome when
       the browser scrolls to #upload-zone. */
    .upload-zone-anchor { scroll-margin-top: 4rem; }

    /* Unconditional photo-count footer — sits at the bottom of every
       gallery so the total is always visible, even when the intro is
       collapsed or doesn't surface a count. */
    .gallery-count {
        margin-top: 2.5rem;
        text-align: center;
        font-size: 0.78rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--main-green);
        opacity: 0.55;
        font-variant-numeric: tabular-nums;
    }

    .empty-state {
        text-align: center;
        padding: 4rem 1rem;
        color: var(--paragraph-colour);
        opacity: 0.6;
    }

    /* Top-right action stack. One or two buttons depending on whether the
       gallery is in selection mode (cancel + download) or normal mode
       (slideshow + optional select). Buttons share styling but the primary
       download variant fills with the accent colour for emphasis. */
    .top-actions {
        position: fixed;
        top: 1rem;
        right: 1.25rem;
        z-index: 10;
        display: inline-flex;
        align-items: center;
        gap: 1.25rem;
    }
    .action-link {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-family: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--main-green);
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        opacity: 0.45;
        transition: opacity 0.2s ease, color 0.2s ease;
    }
    .action-link:hover:not(:disabled) { opacity: 1; }
    .action-link:disabled { cursor: not-allowed; opacity: 0.25; }
    .action-link-icon {
        display: none;
        width: 0.85rem;
        height: 0.85rem;
        flex-shrink: 0;
    }
    .action-link.primary {
        opacity: 1;
        color: var(--header-colour);
    }
    .action-link.primary:disabled { color: var(--paragraph-colour); opacity: 0.45; }
    .action-link.cancel { color: var(--paragraph-colour); }

    @media (max-width: 1100px) {
        .top-actions {
            top: 0.5rem;
            right: 0.75rem;
            gap: 0.5rem;
        }
        .action-link {
            top: 0.5rem;
            width: 2rem;
            height: 2rem;
            box-sizing: border-box;
            justify-content: center;
            align-items: center;
            line-height: 1;
            padding: 0;
            background: var(--inner-background, rgba(0, 0, 0, 0.25));
            border: 1px solid var(--main-green-translucent);
            border-radius: 50%;
            opacity: 0.7;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }
        .action-link { gap: 0; }
        .action-link.primary {
            background: var(--main-green);
            color: var(--background-one, #1c1a17);
            border-color: var(--main-green);
            /* Pill shape when showing the count + status text on mobile. */
            width: auto;
            min-width: 2rem;
            padding: 0 0.75rem;
            border-radius: 999px;
            font-size: 0.8rem;
            letter-spacing: 0.06em;
            gap: 0.35rem;
        }
        .action-link.primary .action-link-text { display: inline; }
        .action-link-text { display: none; }
        .action-link-icon {
            display: block;
            width: 0.95rem;
            height: 0.95rem;
            flex: none;
        }
    }
</style>
