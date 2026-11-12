<!--
    Modal context provider. Sets `simple-modal` context so any section
    can call `open(Component, props, options)` to mount a modal.

    Shared: the homepage wraps its sections in this, and /running wraps its
    dashboard in it too so the run log can open a run in the same window.

    Options:
      - styleWindow: object of extra CSS to apply to the .modal-window
      - onOpen / onClose: lifecycle callbacks

    Also defines a small set of shared modal-body classes as :global() so
    each content modal doesn't have to redefine its own title / subtitle /
    description styles.
-->
<script>
	import { setContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import CloseButton from './CloseButton.svelte';
	let { children } = $props();
	let current = $state(null);
	let previousHtmlOverflow = '';

	$effect(() => {
		if (!current) return;
		// Lock background scroll while a modal is open. We hide overflow on
		// <html> (the page scroll container — see index.css) rather than
		// <body>: <html> honours `scrollbar-gutter: stable` through
		// overflow:hidden, so the reserved scrollbar space stays put and the
		// page never shifts sideways when the modal opens.
		previousHtmlOverflow = document.documentElement.style.overflow;
		document.documentElement.style.overflow = 'hidden';

		const handleKeydown = (e) => {
			if (e.key === 'Escape') close();
		};
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
			document.documentElement.style.overflow = previousHtmlOverflow;
		};
	});

	function open(Component, props = {}, options = {}) {
		const {
			styleWindow = {},
			onOpen,
			onClose: onCloseCallback
		} = options;

		current = {
			Component,
			props,
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

{@render children?.()}

{#if current}
	<!-- Close on a click that lands on the backdrop itself. Clicks inside
	     the window must keep propagating: App.svelte's document listener is
	     what turns an internal link into a client-side navigation, and
	     stopping them here made links in a modal full-reload the site. -->
	<div
		class="modal-backdrop"
		role="presentation"
		onclick={(e) => { if (e.target === e.currentTarget) close(); }}
		transition:fade={{ duration: 200 }}
	>
		<div
			class="modal-window"
			style={Object.entries(current.styleWindow || {}).map(([k, v]) => `${k}: ${v}`).join('; ')}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<CloseButton onclick={close} top="12px" right="12px" />
			<div class="modal-content" data-modal-body>
				<current.Component {...current.props} />
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
		background: var(--scrim);
	}
	.modal-window {
		position: relative;
		width: min(40rem, 100%);
		max-height: 90vh;
		overflow: auto;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-pop);
	}
	.modal-content { padding: var(--space-6) var(--space-5) var(--space-5); }

	/* ===================================================================
	   Shared modal-body classes, :global() so any modal mounted via
	   <svelte:component> picks them up by class name.
	   =================================================================== */
	:global(.modal-title) {
		margin: 0 0 var(--space-1);
		font-size: var(--font-xl);
		font-weight: var(--weight-semibold);
		letter-spacing: -0.02em;
		line-height: 1.2;
		color: var(--text-strong);
	}
	:global(.modal-subtitle) {
		margin: 0;
		font-size: var(--font-md);
		font-weight: var(--weight-medium);
		color: var(--text);
	}
	:global(.modal-meta) {
		margin: var(--space-2) 0 0;
		font-size: var(--font-sm);
		line-height: 1.5;
		color: var(--text-2);
	}
	:global(.modal-description) {
		margin: var(--space-4) 0 0;
		line-height: 1.6;
		color: var(--text);
	}
	:global(ul.modal-description) { padding-left: 1.2em; }
	:global(ul.modal-description li) { margin-bottom: var(--space-2); }
	:global(ul.modal-description li:last-child) { margin-bottom: 0; }
</style>
