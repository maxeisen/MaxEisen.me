<!--
    Shared button. variant: "primary" (filled sand/sage) | "ghost" (outline).
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
		font: inherit;
		font-weight: 600;
		border-radius: var(--radius-sm);
		padding: 0.65rem 1rem;
		cursor: pointer;
		border: 1px solid transparent;
		transition: opacity 0.15s ease, transform 0.1s ease, background 0.15s ease;
	}
	.btn:active:not(:disabled) { transform: scale(0.97); }
	.btn:disabled { opacity: 0.5; cursor: progress; }

	.primary {
		color: var(--background-one);
		background: var(--main-green);
	}
	.primary:hover:not(:disabled) { opacity: 0.92; }

	.ghost {
		color: var(--main-green);
		background: transparent;
		border-color: var(--main-green-translucent);
	}
	.ghost:hover:not(:disabled) { background: var(--main-green-translucent); }
</style>
