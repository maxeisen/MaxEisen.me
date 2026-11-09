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
    import GalleryFilters from "./GalleryFilters.svelte";
    import Lightbox from "./Lightbox.svelte";
    import Slideshow from "./Slideshow.svelte";
    import { downloadPhotos, downloadOne } from "./lib/download.js";
    import { sortPhotos } from "./lib/sortPhotos.js";
    import SiteNav from "../../lib/ui/SiteNav.svelte";
    import Spinner from "../../lib/ui/Spinner.svelte";
    import { fetchJson, FetchError } from "../../lib/data/fetchJson.js";

    let {
        /** Cloudinary tag to fetch. */
        tag,
        /** Title for the <h1>. */
        title = "Gallery",
        /** "date-desc" | "captured-asc" | "filename-asc" | "random" — ordering applied client-side after fetch. */
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
        /** Append each photo's `camera` metadata to its caption — opt-in. */
        showCamera = false,
        /** Enable the People filter row, driven by the `people` index the
            signed API returns (face-crop chips, multi-select). */
        faceFilter = false,
        /** Scene filter config: ordered [{ slug, label }]. The UI shows a chip
            only for scenes that actually appear in the photos. */
        scenes = [],
        /** People filter display order (array of slugs). Unlisted people fall
            to the end. Defaults to API order (most-photographed first). */
        peopleOrder = [],
        /** Intro snippet — fully arbitrary About markup. */
        intro,
    } = $props();

    let photos = $state([]);
    let loading = $state(true);
    let error = $state("");
    let introOpen = $state(false); // collapsed by default; localStorage remembers if expanded
    let password = $state(passwordScope ? null : ""); // empty string = "no gate needed"
    let lightboxOpen = $state(false);
    let lightboxIndex = $state(0);
    let slideshowOpen = $state(false);

    // Face + scene filtering (opt-in via faceFilter / scenes props).
    let people = $state([]);                 // [{slug,name,count,chip}] from the API
    const selectedPeople = new SvelteSet();  // active person slugs
    const selectedScenes = new SvelteSet();  // active scene slugs
    let peopleMode = $state("all");          // "all" (intersection) | "any" (union)
    let sceneMode = $state("any");           // "any" (union) | "all" (intersection)

    // Bulk-download selection state. SvelteSet is reactive on mutation.
    let selectionMode = $state(false);
    const selectedIds = new SvelteSet();
    let downloading = $state(false);
    let downloadProgress = $state(null); // { done, total } | null

    function toggleSelectionMode() {
        selectionMode = !selectionMode;
        if (!selectionMode) selectedIds.clear();
    }

    // MasonryGrid indexes into the photos it renders — which is the FILTERED
    // set (displayPhotos), so selection handlers resolve ids against it too.
    function toggleSelected(originalIdx) {
        const id = displayPhotos[originalIdx]?.public_id;
        if (!id) return;
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
    }

    // Used by MasonryGrid's drag-to-select: it tells us "set photo N to
    // state X" rather than toggling, so the painted state is deterministic
    // across the entire drag path.
    function setSelected(originalIdx, selected) {
        const id = displayPhotos[originalIdx]?.public_id;
        if (!id) return;
        if (selected) selectedIds.add(id);
        else selectedIds.delete(id);
    }

    function toggleAll() {
        if (allSelected) {
            for (const p of displayPhotos) selectedIds.delete(p.public_id);
        } else {
            for (const p of displayPhotos) selectedIds.add(p.public_id);
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

    // === filtering ======================================================
    // Show a scene chip only for scenes that actually appear in the photos.
    const presentScenes = $derived(scenes.filter((s) => photos.some((p) => (p.scenes || []).includes(s.slug))));
    // People in the configured display order (unlisted fall to the end).
    const orderedPeople = $derived.by(() => {
        if (!peopleOrder.length) return people;
        const idx = new Map(peopleOrder.map((s, i) => [s, i]));
        return [...people].sort((a, b) => (idx.get(a.slug) ?? 1e9) - (idx.get(b.slug) ?? 1e9));
    });
    const filtersShown = $derived((faceFilter && people.length > 0) || presentScenes.length > 0);
    const selPeople = $derived([...selectedPeople]);
    const selScenes = $derived([...selectedScenes]);
    // A photo passes if it matches the people filter AND the scene filter.
    // People: union ("any") or intersection ("all"). Scenes: union.
    const displayPhotos = $derived.by(() => {
        if (!selPeople.length && !selScenes.length) return photos;
        return photos.filter((p) => {
            const pl = p.people || [];
            const okP = !selPeople.length
                || (peopleMode === "all" ? selPeople.every((s) => pl.includes(s)) : selPeople.some((s) => pl.includes(s)));
            if (!okP) return false;
            const sl = p.scenes || [];
            return !selScenes.length
                || (sceneMode === "all" ? selScenes.every((s) => sl.includes(s)) : selScenes.some((s) => sl.includes(s)));
        });
    });
    // "All" means all currently-visible (filtered) photos.
    const allSelected = $derived(displayPhotos.length > 0 && displayPhotos.every((p) => selectedIds.has(p.public_id)));

    function togglePerson(slug) { selectedPeople.has(slug) ? selectedPeople.delete(slug) : selectedPeople.add(slug); }
    function toggleScene(slug) { selectedScenes.has(slug) ? selectedScenes.delete(slug) : selectedScenes.add(slug); }
    function clearFilters() { selectedPeople.clear(); selectedScenes.clear(); }

    // Persist intro open/close across visits so collapsed stays collapsed.
    const INTRO_KEY = `gallery-intro-open:${tag}`;

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
            photos = sortPhotos(data.resources || [], sort);
            people = data.people || [];
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
        hint="Private gallery."
    />
{/if}

<SiteNav />

<main class="container">
    <header class="gallery-header">
        <h1>{title}</h1>
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
                                <path d="M5.5 8 L7.5 10 L11 6.5" fill="none" stroke="var(--surface)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
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
        <div class="state" role="status" aria-label="Loading photos" aria-busy="true">
            <Spinner size={24} stroke={2} />
        </div>
    {:else if error}
        <div class="empty-state">{error}</div>
    {:else if !photos.length}
        <div class="empty-state">No photos yet.</div>
    {:else}
        {#if filtersShown}
            <GalleryFilters
                people={faceFilter ? orderedPeople : []}
                scenes={presentScenes}
                {selectedPeople}
                {selectedScenes}
                {peopleMode}
                {sceneMode}
                resultCount={displayPhotos.length}
                total={photos.length}
                onTogglePerson={togglePerson}
                onToggleScene={toggleScene}
                onSetMode={(m) => (peopleMode = m)}
                onSetSceneMode={(m) => (sceneMode = m)}
                onClear={clearFilters}
            />
        {/if}
        {#if !displayPhotos.length}
            <div class="empty-state">No photos match these filters.</div>
        {:else}
            <MasonryGrid
                photos={displayPhotos}
                onopen={open}
                {selectionMode}
                {selectedIds}
                ontoggle={toggleSelected}
                onset={setSelected}
                downloadEnabled={bulkDownloadEnabled}
                ondownload={(idx) => downloadOne(displayPhotos[idx])}
                {showCamera}
            />
        {/if}
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
    photos={displayPhotos}
    bind:open={lightboxOpen}
    bind:index={lightboxIndex}
    downloadEnabled={bulkDownloadEnabled}
    {showCamera}
/>
<Slideshow photos={displayPhotos} bind:open={slideshowOpen} />

<style>
    .container {
        max-width: 1600px;
        margin: 0 auto;
        padding: var(--space-7) var(--page-gutter) var(--space-8);
    }
    /* Slimmer side padding on phones → bigger thumbnails edge-to-edge. */
    @media (max-width: 640px) {
        .container { padding: var(--space-6) var(--space-2) var(--space-7); }
        .gallery-header, .gallery-intro { padding: 0 var(--space-2); }
    }

    .gallery-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-4);
        margin-bottom: var(--space-6);
    }
    h1 {
        margin: 0;
        font-size: var(--font-3xl);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.03em;
        line-height: 1;
        color: var(--text-strong);
    }

    .gallery-intro {
        max-width: 62ch;
        margin: calc(-1 * var(--space-3)) 0 var(--space-6);
        font-size: var(--font-sm);
        color: var(--text);
    }
    .gallery-intro :global(summary) {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        list-style: none;
        cursor: pointer;
        font-size: var(--font-xs);
        font-weight: var(--weight-medium);
        color: var(--text-2);
        user-select: none;
        transition: color var(--dur-fast) var(--ease);
    }
    .gallery-intro :global(summary::-webkit-details-marker) { display: none; }
    .gallery-intro :global(summary:hover) { color: var(--text-strong); }
    .gallery-intro :global(summary::after) {
        content: "";
        width: 0.38em;
        height: 0.38em;
        border-right: 1.5px solid currentColor;
        border-bottom: 1.5px solid currentColor;
        transform: translateY(-0.12em) rotate(45deg);
        transition: transform var(--dur-fast) var(--ease);
    }
    .gallery-intro[open] :global(summary::after) { transform: translateY(0.08em) rotate(-135deg); }
    .gallery-intro-body { margin-top: var(--space-3); line-height: 1.6; color: var(--text-2); }
    .gallery-intro-body :global(p) { margin: 0 0 var(--space-3); color: inherit; }
    .gallery-intro-body :global(p:last-child) { margin-bottom: 0; }
    .gallery-intro-body :global(a) {
        text-decoration: underline;
        text-decoration-color: var(--border-strong);
        text-underline-offset: 0.2em;
    }

    /* Help that appears when upload or download is on — set apart from the
       intro copy so it reads as instructions, not narrative. */
    .gallery-intro-features {
        margin-top: var(--space-3);
        padding-top: var(--space-3);
        border-top: 1px solid var(--border);
        font-size: var(--font-xs);
        line-height: 1.6;
    }
    .gallery-intro-features strong { font-weight: var(--weight-semibold); color: var(--text-strong); }
    .gallery-intro-features em { font-style: normal; font-weight: var(--weight-medium); color: var(--text-strong); }
    .upload-zone-anchor { scroll-margin-top: calc(var(--nav-height) + var(--space-4)); }

    /* Always visible, so the total is there even with the intro collapsed. */
    .gallery-count {
        margin-top: var(--space-6);
        text-align: center;
        font-size: var(--font-xs);
        font-variant-numeric: tabular-nums;
        color: var(--text-3);
    }

    .state { min-height: 60vh; display: flex; align-items: center; justify-content: center; }
    .empty-state { padding: var(--space-8) var(--space-4); text-align: center; color: var(--text-2); }

    /* Header actions: slideshow / select, or, while selecting, cancel / all /
       download. Outline buttons; download is the one filled. Icons only on
       a phone, except download, which keeps its count. */
    .top-actions { display: inline-flex; align-items: center; gap: var(--space-2); }
    .action-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding: 0 12px;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius);
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: var(--font-xs);
        font-weight: var(--weight-medium);
        cursor: pointer;
        transition: background var(--dur-fast) var(--ease);
    }
    .action-link:hover:not(:disabled) { background: var(--surface-2); }
    .action-link:disabled { cursor: not-allowed; opacity: 0.45; }
    .action-link-text::first-letter { text-transform: uppercase; }
    .action-link-icon { width: 14px; height: 14px; flex: none; }
    .action-link.primary { background: var(--text-strong); border-color: var(--text-strong); color: var(--bg); }
    .action-link.primary:hover:not(:disabled) { background: var(--text); }

    @media (max-width: 640px) {
        .action-link { width: 32px; padding: 0; justify-content: center; }
        .action-link-text { display: none; }
        .action-link.primary { width: auto; padding: 0 12px; }
        .action-link.primary .action-link-text { display: inline; }
    }
</style>
