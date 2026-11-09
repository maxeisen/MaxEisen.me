<!--
    The layout Edit/Done toggle for rearrangeable grids (/dashboard and the
    activity pages). Lives in SiteNav's actions slot, and only renders once
    the layout has collapsed to the point where dragging has to be asked
    for — on a wide screen there's nothing to toggle.
-->
<script>
    let { editing = false, onclick } = $props();
</script>

<button
    class="edit-btn"
    class:active={editing}
    type="button"
    aria-pressed={editing ? "true" : "false"}
    aria-label="Toggle layout edit mode"
    {onclick}
>{editing ? "Done" : "Edit"}</button>

<style>
    .edit-btn {
        height: 32px;
        padding: 0 12px;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius);
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: var(--font-xs);
        font-weight: var(--weight-medium);
        white-space: nowrap;
        cursor: pointer;
        transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
    }
    .edit-btn:hover { background: var(--surface-2); }
    .edit-btn.active {
        background: var(--text-strong);
        border-color: var(--text-strong);
        color: var(--bg);
    }
</style>
