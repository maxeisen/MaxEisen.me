<!--
    Bottom-center pill bar of category filter chips + a "routes" toggle
    for the Strava polyline overlay. Multi-select (any combination of
    chips can be active). Empty active set = nothing visible.

    Props:
      categories     — array of strings present in the current pin set
      activeCategories — SvelteSet (live state from parent)
      routesEnabled  — boolean (bindable from parent)
      routesAvailable — boolean — whether to render the routes chip at all
                       (false when Strava returned 0 routes)
-->
<script>
    let {
        categories = [],
        activeCategories,
        routesEnabled = $bindable(true),
        routesAvailable = false,
    } = $props();

    function toggle(cat) {
        if (activeCategories.has(cat)) activeCategories.delete(cat);
        else activeCategories.add(cat);
    }
</script>

<div class="filter-bar" role="toolbar" aria-label="Filter map">
    {#each categories as cat (cat)}
        {@const active = activeCategories.has(cat)}
        <button
            type="button"
            class="chip"
            class:active
            onclick={() => toggle(cat)}
            aria-pressed={active ? "true" : "false"}
        >
            {cat}
        </button>
    {/each}
    {#if routesAvailable}
        <span class="chip-divider" aria-hidden="true"></span>
        <button
            type="button"
            class="chip chip-routes"
            class:active={routesEnabled}
            onclick={() => (routesEnabled = !routesEnabled)}
            aria-pressed={routesEnabled ? "true" : "false"}
        >
            routes
        </button>
    {/if}
</div>

<style>
    .filter-bar {
        position: fixed;
        left: 50%;
        bottom: 1.5rem;
        transform: translateX(-50%);
        z-index: 5;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.4rem 0.5rem;
        background: var(--inner-background, rgba(0, 0, 0, 0.55));
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid var(--main-green-translucent);
        border-radius: 999px;
        max-width: calc(100vw - 2rem);
        overflow-x: auto;
        scrollbar-width: none;
    }
    .filter-bar::-webkit-scrollbar { display: none; }

    .chip {
        font: inherit;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--paragraph-colour);
        background: transparent;
        border: 1px solid transparent;
        padding: 0.35rem 0.85rem;
        border-radius: 999px;
        cursor: pointer;
        white-space: nowrap;
        opacity: 0.55;
        transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
    }
    .chip:hover { opacity: 0.85; }
    .chip.active {
        background: var(--main-green);
        color: var(--background-one, #1c1a17);
        opacity: 1;
    }
    .chip.chip-routes.active {
        background: #fc4c02;     /* Strava orange — matches the route line */
        color: #fff;
    }
    .chip-divider {
        width: 1px;
        height: 1.2rem;
        background: var(--main-green-translucent);
        margin: 0 0.15rem;
        flex-shrink: 0;
    }
</style>
