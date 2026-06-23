<!--
    Face + scene filtering UI for the Gallery — two visually distinct, titled
    sections that combine:
      - People: signed face-crop chips (round avatars), multi-select. With 2+
        selected, an Any/All toggle switches union ↔ intersection.
      - Scenes: labeled pills, multi-select (union).
    The two are independent filters AND-ed together: (matches people) AND
    (matches scenes). The summary bar spells out the active combination + the
    combined result count. Pure presentation + callbacks; each section scrolls
    horizontally so it stays tidy on desktop and mobile.
-->
<script>
    let {
        people = [],
        scenes = [],
        selectedPeople,      // SvelteSet<slug>
        selectedScenes,      // SvelteSet<slug>
        peopleMode = "all",  // "all" | "any"
        sceneMode = "any",   // "any" | "all"
        resultCount = 0,
        total = 0,
        onTogglePerson,
        onToggleScene,
        onSetMode,
        onSetSceneMode,
        onClear,
    } = $props();

    const selPeople = $derived(people.filter((p) => selectedPeople.has(p.slug)));
    const selScenes = $derived(scenes.filter((s) => selectedScenes.has(s.slug)));
    const active = $derived(selPeople.length + selScenes.length > 0);

    // Type-to-find: narrow which people chips are shown (helps guests find
    // themselves). Only worth showing on larger people lists. Selection state
    // is unaffected — a selected person filtered out of view stays selected.
    let peopleQuery = $state("");
    const showSearch = $derived(people.length > 10);
    const shownPeople = $derived.by(() => {
        const q = peopleQuery.trim().toLowerCase();
        return q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
    });

    // Human-readable active-filter summary, e.g. "Lara + Max  ·  Ceremony, Party".
    const summary = $derived.by(() => {
        const parts = [];
        if (selPeople.length) parts.push(selPeople.map((p) => p.name).join(peopleMode === "all" ? " + " : " / "));
        if (selScenes.length) parts.push(selScenes.map((s) => s.label).join(sceneMode === "all" ? " + " : " / "));
        return parts.join("  ·  ");
    });
</script>

{#if people.length || scenes.length}
    <section class="filters" aria-label="Filter photos">
        {#if people.length}
            <div class="group">
                <div class="group-head">
                    <h2 class="group-title">People</h2>
                    {#if showSearch}
                        <input
                            class="people-search"
                            type="search"
                            placeholder="Find a name…"
                            bind:value={peopleQuery}
                            aria-label="Search people by name"
                        />
                    {/if}
                    {#if selectedPeople.size >= 2}
                        <div class="mode" role="group" aria-label="Match mode">
                            <button type="button" class:on={peopleMode === "any"} onclick={() => onSetMode("any")}>Any</button>
                            <button type="button" class:on={peopleMode === "all"} onclick={() => onSetMode("all")}>All</button>
                        </div>
                    {/if}
                </div>
                {#if shownPeople.length === 0}
                    <p class="no-match">No one matches "{peopleQuery}".</p>
                {/if}
                <div class="people" role="group" aria-label="Filter by person">
                    {#each shownPeople as p (p.slug)}
                        <button
                            type="button"
                            class="person"
                            class:on={selectedPeople.has(p.slug)}
                            aria-pressed={selectedPeople.has(p.slug)}
                            title={`${p.name} · ${p.count} photo${p.count === 1 ? "" : "s"}`}
                            onclick={() => onTogglePerson(p.slug)}
                        >
                            <img src={p.chip} alt="" loading="lazy" />
                            <span class="name">{p.name}</span>
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        {#if people.length && scenes.length}
            <hr class="divider" />
        {/if}

        {#if scenes.length}
            <div class="group">
                <div class="group-head">
                    <h2 class="group-title">Scenes</h2>
                    {#if selectedScenes.size >= 2}
                        <div class="mode" role="group" aria-label="Scene match mode">
                            <button type="button" class:on={sceneMode === "any"} onclick={() => onSetSceneMode("any")}>Any</button>
                            <button type="button" class:on={sceneMode === "all"} onclick={() => onSetSceneMode("all")}>All</button>
                        </div>
                    {/if}
                </div>
                <div class="scenes" role="group" aria-label="Filter by scene">
                    {#each scenes as s (s.slug)}
                        <button
                            type="button"
                            class="scene"
                            class:on={selectedScenes.has(s.slug)}
                            aria-pressed={selectedScenes.has(s.slug)}
                            onclick={() => onToggleScene(s.slug)}
                        >
                            {s.label}
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        <div class="bar" class:active>
            {#if active}
                <span class="summary">{summary}</span>
                <span class="count">{resultCount} of {total}</span>
                <button type="button" class="clear" onclick={onClear}>Clear all</button>
            {:else}
                <span class="count muted">{total} photos · tap a face or scene to filter</span>
            {/if}
        </div>
    </section>
{/if}

<style>
    .filters {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin: 0 0 1.5rem 0;
    }
    .group { display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; }
    .group-head {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem 0.75rem;
    }
    .people-search {
        flex: 1 1 150px;
        max-width: 240px;
        padding: 0.35rem 0.7rem;
        font: inherit;
        font-size: 0.85rem;
        color: var(--header-colour);
        background: var(--inner-background, rgba(0, 0, 0, 0.18));
        border: 1.5px solid var(--main-green-translucent, rgba(80, 120, 90, 0.4));
        border-radius: 999px;
        outline: none;
    }
    .people-search::placeholder { color: var(--paragraph-colour); opacity: 0.6; }
    .people-search:focus { border-color: var(--main-green, #4a7c59); }
    .no-match {
        margin: 0.1rem 0 0.3rem;
        font-size: 0.82rem;
        color: var(--paragraph-colour);
        opacity: 0.7;
    }
    .group-title {
        margin: 0;
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-size: 1rem;
        letter-spacing: -0.01em;
        color: var(--header-colour);
    }
    .divider {
        border: 0;
        border-top: 1px solid var(--main-green-translucent, rgba(80,120,90,0.25));
        margin: 0;
    }

    /* People: a multi-row grid on desktop (no scrollbar) — 11 across at full
       width → tidy even rows. Collapses columns as it narrows, then becomes a
       horizontal scroller on phones with the scrollbar hidden and a right-edge
       fade hinting there's more to swipe to. */
    .people {
        display: grid;
        grid-template-columns: repeat(11, minmax(0, 1fr));
        gap: 0.9rem 0.4rem;
        justify-items: center;
    }
    @media (max-width: 1200px) { .people { grid-template-columns: repeat(8, minmax(0, 1fr)); } }
    @media (max-width: 900px)  { .people { grid-template-columns: repeat(6, minmax(0, 1fr)); } }

    /* Scenes: wrap to multiple rows on desktop; horizontal scroll on phones. */
    .scenes { display: flex; flex-wrap: wrap; gap: 0.5rem; }

    @media (max-width: 640px) {
        .people, .scenes {
            display: flex;
            flex-wrap: nowrap;
            overflow-x: auto;
            gap: 0.6rem;
            padding-bottom: 0.3rem;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            /* fade the right edge → "there's more this way" */
            -webkit-mask-image: linear-gradient(to right, #000 90%, transparent);
            mask-image: linear-gradient(to right, #000 90%, transparent);
        }
        .people::-webkit-scrollbar, .scenes::-webkit-scrollbar { display: none; }
        /* keep chips compact on phones (the desktop sizes are larger) */
        .person { width: 70px; }
        .person img { width: 58px; height: 58px; }
        .person .name { max-width: 70px; }
    }

    /* Person chip: round avatar + name (clearly distinct from scene pills). */
    .person {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.4rem;
        width: 92px;
        padding: 0;
        border: 0;
        background: none;
        cursor: pointer;
    }
    .person img {
        width: 78px;
        height: 78px;
        border-radius: 50%;
        object-fit: cover;
        background: var(--main-green-translucent, rgba(80,120,90,0.2));
        border: 2.5px solid transparent;
        transition: border-color 0.15s ease, transform 0.1s ease;
    }
    .person .name {
        font-size: 0.82rem;
        line-height: 1.15;
        color: var(--paragraph-colour);
        max-width: 92px;
        min-height: 1.9em;            /* reserve 2 lines so chips align evenly */
        text-align: center;
        display: -webkit-box;
        -webkit-line-clamp: 2;        /* full first names, wrapping to 2 lines */
        -webkit-box-orient: vertical;
        overflow: hidden;
        transition: color 0.15s ease;
    }
    .person:hover img { transform: translateY(-1px); }
    .person.on img { border-color: var(--main-green, #4a7c59); }
    .person.on .name { color: var(--header-colour); font-weight: 600; }

    /* Scene pill: rectangular rounded pill (clearly distinct from face chips). */
    .scene {
        flex: 0 0 auto;
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        border: 1.5px solid var(--main-green-translucent, rgba(80,120,90,0.4));
        background: transparent;
        color: var(--paragraph-colour);
        font-size: 0.82rem;
        white-space: nowrap;
        cursor: pointer;
        scroll-snap-align: start;
        transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .scene:hover { border-color: var(--main-green, #4a7c59); }
    .scene.on {
        background: var(--main-green, #4a7c59);
        border-color: var(--main-green, #4a7c59);
        color: var(--background-one, #1c1a17);
        font-weight: 600;
    }

    /* Any/All toggle. */
    .mode {
        display: inline-flex;
        border: 1.5px solid var(--main-green-translucent, rgba(80,120,90,0.4));
        border-radius: 999px;
        overflow: hidden;
    }
    .mode button {
        border: 0;
        background: transparent;
        color: var(--paragraph-colour);
        font-size: 0.7rem;
        padding: 0.25rem 0.6rem;
        cursor: pointer;
    }
    .mode button.on { background: var(--main-green, #4a7c59); color: var(--background-one, #1c1a17); font-weight: 600; }

    .bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.4rem 1rem;
        font-size: 0.82rem;
        color: var(--paragraph-colour);
        padding-top: 0.25rem;
    }
    .bar .summary { font-weight: 600; color: var(--header-colour); }
    .bar .count { font-variant-numeric: tabular-nums; opacity: 0.8; }
    .bar .count.muted { opacity: 0.55; }
    .clear {
        border: 0;
        background: none;
        color: var(--main-green, #6aa67f);
        cursor: pointer;
        font-size: 0.82rem;
        text-decoration: underline;
        padding: 0;
        margin-left: auto;
    }

    @media (max-width: 640px) {
        .clear { margin-left: 0; }
    }
</style>
