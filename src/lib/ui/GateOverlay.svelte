<!--
    Shared password-gate overlay used by /bach and the friends-only galleries.
    Renders the blurred backdrop, the frosted card, a single password field, and
    a submit button. The parent owns the actual auth logic and passes an
    onsubmit handler plus a bindable `value`.
-->
<script>
	import { onMount } from 'svelte';
	import Button from './Button.svelte';

	let {
		title,
		subtitle = '',
		label = 'Password',
		inputId = 'gate-input',
		value = $bindable(''),
		error = '',
		busy = false,
		submitLabel = 'Enter',
		busyLabel = 'Checking…',
		inputType = 'password',
		autofocus = true,
		onsubmit,
	} = $props();

	let inputEl;
	onMount(() => {
		if (autofocus) requestAnimationFrame(() => inputEl?.focus());
	});
</script>

<div class="gate" role="dialog" aria-modal="true">
	<form class="gate-form surface" {onsubmit}>
		<h1 class="gate-title">{title}</h1>
		{#if subtitle}<p class="gate-sub">{subtitle}</p>{/if}
		<label for={inputId}>{label}</label>
		<input
			bind:this={inputEl}
			bind:value
			id={inputId}
			type={inputType}
			autocomplete="off"
			required
			disabled={busy}
		/>
		<Button type="submit" disabled={busy || !value}>
			{busy ? busyLabel : submitLabel}
		</Button>
		{#if error}<div class="gate-error">{error}</div>{/if}
	</form>
</div>

<style>
	.gate {
		position: fixed;
		inset: 0;
		z-index: var(--z-gate);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
		background: var(--bg);
	}
	.gate-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: min(380px, 100%);
		padding: var(--space-6);
		border-radius: var(--radius-lg);
	}
	.gate-title {
		margin: 0;
		font-size: var(--font-xl);
		font-weight: var(--weight-semibold);
		letter-spacing: -0.02em;
		color: var(--text-strong);
	}
	.gate-sub { margin: 0; font-size: var(--font-sm); color: var(--text-2); }
	label {
		margin-top: var(--space-2);
		font-size: var(--font-xs);
		font-weight: var(--weight-medium);
		color: var(--text-2);
	}
	input {
		height: 40px;
		padding: 0 var(--space-3);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text-strong);
		font: inherit;
		outline: none;
		transition: border-color var(--dur-fast) var(--ease);
	}
	input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
	.gate-error { font-size: var(--font-xs); color: var(--tone-bad); }
</style>
