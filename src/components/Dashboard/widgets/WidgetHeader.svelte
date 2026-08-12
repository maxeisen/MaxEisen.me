<!--
	The link in a widget's top-right, plus its optional category label.

	Links off-site by default. An internal one has to drop target="_blank" as
	well as the arrow: App.svelte's click handler ignores any anchor with a
	target, so leaving it would full-load the route instead of navigating
	client-side.
-->
<script>
	let { profileHref, profileLabel, label = null, external = true } = $props();
</script>

<a
	class="profile-link"
	href={profileHref}
	target={external ? "_blank" : null}
	rel={external ? "noreferrer" : null}
>{profileLabel} {external ? "↗" : "→"}</a>
{#if label}
	<div class="widget-label">{label}</div>
{/if}
