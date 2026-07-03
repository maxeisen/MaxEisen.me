<!--
    Modal context provider. Sets `simple-modal` context so any homepage
    section can call `open(Component, props, options)` to mount a modal.

    Options:
      - wide:        widen the modal window to ~950px (used by long-form
                     content like the blog post modal). Replaces the
                     previous hack where supplying a custom close-button
                     component was the implicit trigger for "wide".
      - styleWindow: object of extra CSS to apply to the .modal-window
      - onOpen / onClose: lifecycle callbacks

    Also defines a small set of shared modal-body classes as :global() so
    each content modal doesn't have to redefine its own title / subtitle /
    description styles.
-->
<script>
	import { setContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import CloseButton from '../../../lib/ui/CloseButton.svelte';
	import { lockBodyScroll, unlockBodyScroll } from '../../../lib/ui/bodyScrollLock.js';

	let current = $state(null);

	$effect(() => {
		if (!current) return;
		lockBodyScroll();

		const handleKeydown = (e) => {
			if (e.key === 'Escape') close();
		};
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
			unlockBodyScroll();
		};
	});

	function open(Component, props = {}, options = {}) {
		const {
			wide = false,
			styleWindow = {},
			onOpen,
			onClose: onCloseCallback
		} = options;

		current = {
			Component,
			props,
			wide,
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
			class="modal-window {current.wide ? 'modal-window--wide' : ''}"
			style={Object.entries(current.styleWindow || {}).map(([k, v]) => `${k}: ${v}`).join('; ')}
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<CloseButton onclick={close} />
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
	.modal-content {
		padding: 1.5rem;
	}

	/* ===================================================================
	   Shared modal-body classes. Defined :global() so any modal mounted
	   via <svelte:component> picks them up by class name. Each content
	   modal previously redefined its own title / subtitle / description
	   under different class names — these consolidate the duplicates.
	   =================================================================== */
	:global(.modal-title) {
		font-family: 'Fraunces', 'Iowan Old Style', 'Times New Roman', serif;
		font-weight: 600;
		font-optical-sizing: auto;
		letter-spacing: -0.02em;
		font-size: 35px;
		margin: 15px 15px 10px 15px;
		text-align: center;
		color: var(--modal-title-colour);
		transition: all 0.2s ease-in;
	}
	:global(.modal-subtitle) {
		font-size: 25px;
		margin: 5px auto;
		text-align: center;
		color: var(--modal-title-colour);
		transition: all 0.2s ease-in;
	}
	:global(.modal-subtitle a) {
		color: var(--modal-link-colour);
		transition: color 0.2s ease-in;
	}
	:global(.modal-subtitle a:hover) {
		color: var(--link-hover-colour);
	}
	:global(.modal-meta) {
		font-size: 16px;
		margin: 10px auto;
		text-align: center;
		color: var(--modal-subtitle-colour, var(--modal-text-colour));
		line-height: 1.4;
	}
	:global(.modal-description) {
		margin: 8px auto 10px auto;
		color: var(--modal-text-colour);
		line-height: 1.6;
	}
	:global(ul.modal-description li) {
		margin-bottom: 10px;
	}
	:global(ul.modal-description li:last-child) {
		margin-bottom: 0;
	}
</style>
