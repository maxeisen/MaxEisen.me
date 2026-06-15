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
	<form class="gate-form" {onsubmit}>
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
		background: rgba(28, 26, 23, 0.92);
		backdrop-filter: blur(var(--blur-md));
		-webkit-backdrop-filter: blur(var(--blur-md));
		padding: 1rem;
	}
	.gate-form {
		min-width: min(380px, 92vw);
		padding: 1.75rem 2rem;
		border-radius: var(--radius-lg);
		background: var(--background-one);
		border: 1px solid var(--main-green-translucent);
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}
	.gate-title {
		font-family: var(--font-serif);
		font-weight: 700;
		font-size: 1.7rem;
		letter-spacing: -0.02em;
		color: var(--header-colour);
		margin: 0;
	}
	.gate-sub {
		font-size: 0.9rem;
		color: var(--paragraph-colour);
		opacity: 0.8;
		margin: 0;
	}
	label {
		font-size: var(--font-2xs);
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--main-green);
	}
	input {
		font: inherit;
		color: var(--header-colour);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--main-green-translucent);
		border-radius: var(--radius-sm);
		padding: 0.6rem 0.75rem;
		outline: none;
		transition: border-color 0.15s ease, background 0.15s ease;
	}
	input:focus {
		border-color: var(--main-green);
		background: rgba(255, 255, 255, 0.06);
	}
	.gate-error {
		font-size: 0.82rem;
		color: var(--color-error);
	}
</style>
