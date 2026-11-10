<!--
    The layout Edit/Done toggle for rearrangeable grids (/dashboard and the
    activity pages). It floats in the bottom-right corner rather than sitting
    in the nav bar: the bar is identical on every page, so a control only
    some pages have would push its links over on those pages. Floating also
    keeps it reachable when the dashboard's nav is tucked away.

    Each page decides when to show it: the dashboard always (edit mode is
    also where widgets are shown and hidden), the activity pages once their
    layout has collapsed and dragging has to be asked for. A page that shows
    it leaves room at its foot so it never covers content at rest.
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
        position: fixed;
        right: max(var(--page-gutter), env(safe-area-inset-right));
        bottom: max(12px, calc(env(safe-area-inset-bottom) + 8px));
        z-index: var(--z-sticky);
        height: 30px;
        padding: 0 14px;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-pill);
        background: var(--surface);
        box-shadow: var(--shadow-pop);
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
