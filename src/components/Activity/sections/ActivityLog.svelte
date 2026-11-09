<!--
    Recent-activity list shared by the running and cycling dashboards.

    The card, the scroll, and the row chrome live here. Each sport passes the
    row contents as snippets: `primary` for the activities that open in the
    modal, `context` for the ones that only link out to Strava.
-->
<script>
    import { getContext } from "svelte";
    import Card from "../../../lib/ui/Card.svelte";
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
        max-height: 560px;
        overflow-y: auto;
    }
    .log li + li { border-top: 1px solid var(--border); }

    .row {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        width: 100%;
        padding: var(--space-3) var(--space-2);
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        text-decoration: none;
        cursor: pointer;
        -webkit-appearance: none;
        appearance: none;
        transition: background-color var(--dur-fast) var(--ease);
    }
    .row:hover { background: var(--surface-2); }
    .row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    /* Rides and strength on the running log are context: present, quieter. */
    .row.ride, .row.strength { opacity: 0.7; }
    .row.ride:hover, .row.strength:hover { opacity: 1; }

    /* Row content conventions, shared by every sport's row snippets:
       .row-main (.row-name, .row-meta, .row-note) and .row-stat columns. */
    .log :global(.row-main) { flex: 1; min-width: 0; }
    .log :global(.row-name) {
        display: block;
        font-size: var(--font-sm);
        font-weight: var(--weight-medium);
        color: var(--text-strong);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .log :global(.row-meta) {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 2px 6px;
        margin-top: 2px;
        font-size: var(--font-2xs);
        line-height: 1.6;
        color: var(--text-2);
    }
    .log :global(.row-stat) {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        flex-shrink: 0;
        min-width: 82px;
        text-align: right;
        font-variant-numeric: tabular-nums;
    }
    .log :global(.row-stat strong) {
        font-size: var(--font-sm);
        font-weight: var(--weight-semibold);
        line-height: 1.3;
        color: var(--text-strong);
    }
    .log :global(.row-stat span) { font-size: var(--font-2xs); color: var(--text-3); }

    @media (max-width: 540px) {
        .log :global(.row-main) { flex-basis: 100%; }
        .log :global(.row-stat) { min-width: 0; align-items: flex-start; text-align: left; }
        .log :global(.row-stat + .row-stat) { align-items: flex-end; text-align: right; }
        .row {
            flex-wrap: wrap;
            justify-content: space-between;
            gap: var(--space-2) var(--space-4);
        }
    }
</style>
