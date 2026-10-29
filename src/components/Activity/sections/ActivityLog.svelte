<!--
    Recent-activity list shared by the running and cycling dashboards.

    The card, the scroll, and the row chrome live here. Each sport passes the
    row contents as snippets: `primary` for the activities that open in the
    modal, `context` for the ones that only link out to Strava.
-->
<script>
    import { getContext } from "svelte";
    import Card from "../Card.svelte";
    import { GLOSSARY } from "../../Training/lib/glossary.js";

    let {
        items = [],
        info = GLOSSARY.runs,
        empty = "Nothing synced yet.",
        isPrimary = () => true,
        rowClass = () => "",
        onOpen = null,
        summary,
        primary,
        context = null,
    } = $props();

    const modal = getContext("simple-modal");
    const canOpen = $derived(typeof modal?.open === "function" && typeof onOpen === "function");
</script>

<Card title="Recent activity" {info}>
    {#snippet aside()}
        {@render summary?.()}
    {/snippet}

    {#if items.length === 0}
        <p class="card-empty">{empty}</p>
    {:else}
        <ul class="log">
            {#each items as item (item.id)}
                {@const openable = isPrimary(item)}
                <li>
                    {#if openable && canOpen}
                        <button type="button" class="row {rowClass(item)}" onclick={() => onOpen(item)}>
                            {@render primary(item)}
                        </button>
                    {:else}
                        <a
                            class="row {rowClass(item)}"
                            href="https://www.strava.com/activities/{item.id}"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {@render (context && !openable ? context : primary)(item)}
                        </a>
                    {/if}
                </li>
            {/each}
        </ul>
    {/if}
</Card>

<style>
    .log {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        max-height: 560px;
        overflow-y: auto;
    }
    .log li + li { border-top: 1px solid var(--main-green-translucent); padding-top: var(--space-2); }

    .row {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        width: 100%;
        padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
        border: 0;
        border-left: 2px solid var(--main-green);
        border-radius: var(--radius-sm);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        text-decoration: none;
        cursor: pointer;
        -webkit-appearance: none;
        appearance: none;
        transition: background-color 0.15s ease;
    }
    .row:focus-visible {
        outline: 2px solid var(--main-green);
        outline-offset: 2px;
    }
    .row.extra { border-left-color: transparent; }
    .row.ride,
    .row.strength { border-left-style: dashed; border-left-color: var(--paragraph-colour); opacity: 0.75; }
    .row:hover { background: var(--main-green-translucent); }

    @media (max-width: 540px) {
        .log { gap: var(--space-3); }
        .log li + li { padding-top: var(--space-3); }
        .row {
            flex-wrap: wrap;
            justify-content: space-between;
            gap: var(--space-2) var(--space-4);
        }
    }
</style>
