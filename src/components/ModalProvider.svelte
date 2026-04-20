<script>
	import { setContext } from 'svelte';
	import { fade } from 'svelte/transition';

	let current = $state(null);

	$effect(() => {
		if (!current) return;
		const handleKeydown = (e) => {
			if (e.key === 'Escape') close();
		};
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	function open(Component, props = {}, options = {}) {
		const {
			closeButton: CloseButtonComponent,
			styleWindow = {},
			onOpen,
			onClose: onCloseCallback
		} = options;

		current = {
			Component,
			props,
			CloseButtonComponent,
			styleWindow,
			onCloseCallback
		};
		onOpen?.();
	}

	function close() {
		if (current?.onCloseCallback) current.onCloseCallback();
		current = null;
	}

	setContext('simple-modal', { open });
</script>

<slot />

{#if current}
	<div
		class="modal-backdrop"
		role="presentation"
		onclick={close}
		transition:fade={{ duration: 200 }}
	>
		<div
			class="modal-window {current.CloseButtonComponent ? 'modal-window--wide' : ''}"
			style={Object.entries(current.styleWindow || {}).map(([k, v]) => `${k}: ${v}`).join('; ')}
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<div class="modal-close-row">
				{#if current.CloseButtonComponent}
					{@const CloseBtn = current.CloseButtonComponent}
					<CloseBtn onClose={close} />
				{:else}
					<button type="button" class="modal-close-default" onclick={close} aria-label="Close">×</button>
				{/if}
			</div>
			<div class="modal-content" data-modal-body>
				<svelte:component this={current.Component} {...current.props} />
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}
	.modal-window {
		background: var(--modal-background, #fff);
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.35);
		max-width: 40rem;
		max-height: 90vh;
		overflow: auto;
		position: relative;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
	}
	.modal-window--wide {
		width: 59.375rem; /* 950px */
		max-width: 90rem;
	}
	@media only screen and (max-width: 860px) {
		.modal-window,
		.modal-window--wide {
			width: 90%;
			max-width: 90vw;
		}
	}
	.modal-close-row {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}
	.modal-close-default {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
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
		z-index: 10;
	}
	.modal-close-default:hover {
		background: rgba(100, 100, 100, 0.95);
	}
	.modal-content {
		padding: 1.5rem;
	}
</style>
