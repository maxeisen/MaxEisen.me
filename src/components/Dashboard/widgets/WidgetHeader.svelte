<!--
	A widget's header: its label on the left, a link out on the right.
	Without a label (Spotify, whose own status line names it) only the link
	renders, pinned to the corner.

	Links off-site by default. An internal one has to drop target="_blank" as
	well as the arrow: App.svelte's click handler ignores any anchor with a
	target, so leaving it would full-load the route instead of navigating
	client-side.
-->
<script>
	let { profileHref, profileLabel, label = null, external = true } = $props();
</script>

{#snippet link()}
	<a
		class="widget-link"
		href={profileHref}
		target={external ? "_blank" : null}
		rel={external ? "noreferrer" : null}
	>{profileLabel} {external ? "↗" : "→"}</a>
{/snippet}

{#if label}
	<div class="widget-head">
		<span class="widget-label">{label}</span>
		{@render link()}
	</div>
{:else}
	<div class="corner">{@render link()}</div>
{/if}

<style>
	.widget-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		flex: none;
		margin-bottom: var(--space-3);
	}
	.corner {
		position: absolute;
		top: 14px;
		right: 16px;
		z-index: 2;
	}
	/* Global so widgets that label a second region (Weather's "Sun and
	   moon") can use the same style without a second header. */
	:global(.widget-label) {
		font-size: var(--font-xs);
		font-weight: var(--weight-medium);
		color: var(--text-2);
	}
	.widget-link {
		font-size: var(--font-xs);
		color: var(--text-3);
		white-space: nowrap;
		transition: color var(--dur-fast) var(--ease);
	}
	.widget-link:hover { color: var(--text-strong); }

	@container slot (max-height: 200px) {
		.widget-head { margin-bottom: var(--space-2); }
		.corner { top: 10px; right: 12px; }
	}
	/* A strip-sized widget has no room for the corner link. */
	@container slot (max-height: 110px) {
		.corner { display: none; }
	}
</style>
