<!--
    Shared loading spinner (the ring visual only). It is decorative
    (aria-hidden); wrap it in an element with role="status" / aria-label where a
    status announcement is needed, as the route loader and gates do.

    Props: size (px), stroke (px).
-->
<script>
	let { size = 38, stroke = 3 } = $props();
</script>

<div
	class="spinner"
	style="--spinner-size: {size}px; --spinner-stroke: {stroke}px;"
	aria-hidden="true"
></div>

<style>
	.spinner {
		width: var(--spinner-size);
		height: var(--spinner-size);
		border: var(--spinner-stroke) solid var(--main-green-translucent, rgba(184, 168, 136, 0.3));
		border-top-color: var(--main-green, #b8a888);
		border-radius: 50%;
		animation: spinner-rotate 0.7s linear infinite;
	}
	@keyframes spinner-rotate {
		to { transform: rotate(360deg); }
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner { animation-duration: 1.6s; }
	}
</style>
