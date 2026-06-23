<script>
	let { profileHref, profileLabel, label = null } = $props();
</script>

<a class="profile-link" href={profileHref} target="_blank" rel="noreferrer">{profileLabel} ↗</a>
{#if label}
	<div class="widget-label">{label}</div>
{/if}
