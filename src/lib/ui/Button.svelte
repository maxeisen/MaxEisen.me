<!--
    Shared button. variant: "primary" (filled, ink) | "ghost" (outline).
    Forwards arbitrary attributes (type, disabled, onclick, aria-*, ...).
-->
<script>
	let {
		variant = 'primary',
		type = 'button',
		disabled = false,
		children,
		...rest
	} = $props();
</script>

<button class="btn {variant}" {type} {disabled} {...rest}>
	{@render children?.()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		height: 40px;
		padding: 0 var(--space-4);
		border: 1px solid transparent;
		border-radius: var(--radius);
		font: inherit;
		font-size: var(--font-sm);
		font-weight: var(--weight-medium);
		cursor: pointer;
		transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
	}
	.btn:disabled { opacity: 0.5; cursor: progress; }

	.primary { background: var(--text-strong); color: var(--bg); }
	.primary:hover:not(:disabled) { background: var(--text); }

	.ghost { background: transparent; color: var(--text); border-color: var(--border-strong); }
	.ghost:hover:not(:disabled) { background: var(--surface-2); }
</style>
