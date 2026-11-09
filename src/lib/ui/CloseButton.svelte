<!--
    Shared circular close button (the "x" used by modal windows + drawers).
    Absolutely positioned; pass top/right to place it within the parent.
    Forwards onclick and any other attributes.
-->
<script>
	let { onclick, top = '0.5rem', right = '0.5rem', label = 'Close', ...rest } = $props();
</script>

<button
	class="close-btn"
	type="button"
	{onclick}
	aria-label={label}
	style="top: {top}; right: {right};"
	{...rest}
>
	<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
</button>

<style>
	.close-btn {
		position: absolute;
		z-index: var(--z-raised);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 0;
		border-radius: var(--radius);
		background: transparent;
		color: var(--text-2);
		cursor: pointer;
		transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
	}
	.close-btn:hover { background: var(--surface-2); color: var(--text-strong); }
	svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
</style>
