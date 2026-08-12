<!--
    The edit-mode pill from /dashboard, shared with /training.

    It only appears once a layout has collapsed to the point where dragging
    has to be asked for; on a wide screen there's nothing to toggle, so the
    page doesn't render it at all.
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
>
    <span class="edit-icon" aria-hidden="true">✎</span>
    <span class="edit-label">{editing ? "Done" : "Edit"}</span>
</button>

<style>
    .edit-btn {
        position: fixed;
        top: 0.5rem;
        right: 0.75rem;
        z-index: 50;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.45rem 0.85rem;
        background: var(--inner-background, rgba(0, 0, 0, 0.35));
        border: 1px solid var(--main-green-translucent);
        border-radius: 999px;
        color: var(--main-green);
        font-family: inherit;
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        cursor: pointer;
        opacity: 0.85;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: background 0.2s ease, color 0.2s ease, opacity 0.2s ease;
    }
    .edit-btn:hover { opacity: 1; }
    .edit-btn:active { transform: scale(0.96); }
    .edit-btn.active {
        background: var(--main-green);
        color: var(--background-one);
        border-color: var(--main-green);
        opacity: 1;
    }
    .edit-icon { font-size: 0.95rem; line-height: 1; }
</style>
