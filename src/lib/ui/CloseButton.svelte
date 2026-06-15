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
>&times;</button>

<style>
	.close-btn {
		position: absolute;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: rgba(80, 80, 80, 0.9);
		color: #fff;
		border: none;
		font-size: 1.25rem;
		line-height: 1;
		padding: 0;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--z-raised);
		transition: background 0.2s ease;
	}
	.close-btn:hover { background: rgba(100, 100, 100, 0.95); }
</style>
