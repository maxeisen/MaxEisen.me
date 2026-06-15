<!--
    Shared "back to homepage" link for SPA routes (/gallery, /toronto,
    /dashboard). Desktop: a small uppercase "<- back" label pinned top-left.
    Mobile (<=1100px): collapses to a frosted circular arrow button so it reads
    consistently with the gallery action buttons.

    By default a click prefers history.back() when the visitor arrived from the
    same origin (returning them where they came from), otherwise it follows
    href. Pass historyBack={false} to always navigate to href.
-->
<script>
	let { href = '/', label = 'back', historyBack = true } = $props();

	function onClick(e) {
		if (!historyBack) return;
		try {
			const fromSameOrigin = document.referrer &&
				new URL(document.referrer).origin === window.location.origin;
			if (fromSameOrigin && window.history.length > 1) {
				e.preventDefault();
				window.history.back();
			}
		} catch { /* fall through to href */ }
	}
</script>

<a class="home-link" {href} onclick={onClick} aria-label="Back to homepage">
	<span class="home-link-text">&larr; {label}</span>
	<svg class="home-link-arrow" viewBox="0 0 16 16" aria-hidden="true">
		<path d="M12.5 8 H3.5 M6.5 5 L3.5 8 L6.5 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
	</svg>
</a>

<style>
	.home-link {
		position: fixed;
		top: 1rem;
		left: 1.25rem;
		z-index: var(--z-raised);
		display: inline-flex;
		align-items: center;
		font-size: var(--font-xs);
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--main-green);
		text-decoration: none;
		opacity: 0.45;
		transition: opacity 0.2s ease;
	}
	.home-link:hover { opacity: 1; }
	.home-link-arrow {
		display: none;
		width: 0.95rem;
		height: 0.95rem;
		flex-shrink: 0;
	}
	@media (max-width: 1100px) {
		.home-link {
			top: 0.5rem;
			left: 0.75rem;
			width: 2rem;
			height: 2rem;
			box-sizing: border-box;
			justify-content: center;
			align-items: center;
			line-height: 1;
			padding: 0;
			background: var(--inner-background, rgba(0, 0, 0, 0.25));
			border: 1px solid var(--main-green-translucent);
			border-radius: 50%;
			opacity: 0.7;
			backdrop-filter: blur(var(--blur-md));
			-webkit-backdrop-filter: blur(var(--blur-md));
		}
		.home-link-text { display: none; }
		.home-link-arrow { display: block; }
	}
</style>
