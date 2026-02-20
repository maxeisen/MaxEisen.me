<script>
	export let onClose;
</script>

<button type="button" class="close-btn" onclick={onClose} aria-label="Close">×</button>

<style>
	.close-btn {
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
	}
	.close-btn:hover {
		background: rgba(100, 100, 100, 0.95);
	}
</style>