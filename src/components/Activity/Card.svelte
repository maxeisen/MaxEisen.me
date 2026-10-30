<!--
    Training panel shell. Same surface recipe as a /dashboard `.widget`, plus
    a title, optional aside, and an in-flow "i" disclosure (a popover on a
    phone would have to be flipped and clamped; this cannot leave the card).

    Nested tiles use --item-background so they stay visible on the card's
    --inner-background. Reversing those tokens makes a card-in-a-card vanish.
-->
<script>
	let {
		title = null,
		level = 2,
		info = null,
		className = "",
		aside = null,
		children,
	} = $props();

	let open = $state(false);
	const panelId = `card-info-${Math.random().toString(36).slice(2, 9)}`;
</script>

<section class="card {className}">
	{#if title || aside}
		<div class="card-head">
			<svelte:element this={`h${level}`} class="card-title">
				{title}
				{#if info}
					<button
						type="button"
						class="info-btn"
						class:open
						aria-expanded={open}
						aria-controls={panelId}
						aria-label={open ? `Hide what ${title} means` : `What does ${title} mean?`}
						onclick={() => (open = !open)}
					>
						<!-- SVG, not a glyph: a lowercase "i" never sits on
						     the circle's true centre. -->
						<svg viewBox="0 0 16 16" aria-hidden="true">
							<circle cx="8" cy="4.6" r="1.15" />
							<rect x="6.85" y="7.2" width="2.3" height="5.4" rx="1.15" />
						</svg>
					</button>
				{/if}
			</svelte:element>
			{#if aside}
				<div class="card-aside">{@render aside()}</div>
			{/if}
		</div>
	{/if}

	{#if info && open}
		<div class="info-panel" id={panelId}>
			{#each info.body || [] as paragraph}
				<p>{paragraph}</p>
			{/each}
			{#if info.terms?.length}
				<dl>
					{#each info.terms as { term, definition }}
						<dt>{term}</dt>
						<dd>{definition}</dd>
					{/each}
				</dl>
			{/if}
		</div>
	{/if}

	{@render children()}
</section>

<style>
	.card {
		background: var(--inner-background);
		border: 1px solid var(--main-green-translucent);
		border-radius: var(--radius-xl);
		padding: var(--space-5);
		box-shadow: var(--inner-box-shadow);
		backdrop-filter: blur(var(--blur-md));
		-webkit-backdrop-filter: blur(var(--blur-md));
		min-width: 0;
	}

	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
		margin-bottom: var(--space-4);
	}
	.card-title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-sans);
		font-size: var(--font-lg);
		font-weight: 600;
		color: var(--header-colour);
		margin: 0;
	}
	.card-aside {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		min-width: 0;
	}

	/* Shared inner-card conventions. Scoped so they cannot reach /dashboard. */
	.card :global(.card-empty) {
		font-size: var(--font-sm);
		color: var(--paragraph-colour);
		opacity: 0.7;
		margin: 0;
	}
	.card :global(.chart-unit) {
		margin: var(--space-2) 0 0;
		font-size: var(--font-2xs);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--paragraph-colour);
		opacity: 0.5;
	}

	/* Run-log / last-run tag. Font-size is inherited from the row. */
	.card :global(.tag) {
		display: inline-block;
		padding: 1px 6px;
		border-radius: var(--radius-pill);
		background: var(--main-green-translucent);
		color: var(--main-green);
		font-weight: 600;
		letter-spacing: 0.04em;
	}
	.card :global(.tag.plan) {
		background: var(--tone-good-bg);
		color: var(--tone-good);
		text-transform: lowercase;
	}
	.card :global(.tag.extra) {
		background: transparent;
		border: 1px solid var(--main-green-translucent);
		color: var(--paragraph-colour);
		opacity: 0.8;
	}

	.info-btn {
		flex: none;
		width: 1.2rem;
		height: 1.2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--main-green-translucent);
		border-radius: 50%;
		background: transparent;
		color: var(--main-green);
		line-height: 0;
		cursor: pointer;
		opacity: 0.75;
		transition: opacity 0.15s ease, background-color 0.15s ease;
	}
	.info-btn svg {
		width: 68%;
		height: 68%;
		display: block;
		fill: currentColor;
	}
	.info-btn:hover, .info-btn:focus-visible { opacity: 1; background: var(--main-green-translucent); }
	.info-btn.open {
		opacity: 1;
		background: var(--main-green);
		border-color: var(--main-green);
		color: var(--badge-text-colour);
	}

	.info-panel {
		margin: 0 0 var(--space-4) 0;
		padding: var(--space-4);
		border-radius: var(--radius-md);
		background: var(--item-background);
		border-left: 3px solid var(--main-green);
	}
	.info-panel p {
		font-size: var(--font-xs);
		line-height: 1.65;
		color: var(--paragraph-colour);
		opacity: 0.9;
		margin: 0 0 var(--space-3) 0;
		max-width: 68ch;
	}
	.info-panel p:last-child { margin-bottom: 0; }
	.info-panel dl {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-1) var(--space-3);
		margin: 0;
		font-size: var(--font-xs);
		line-height: 1.5;
	}
	.info-panel dt {
		font-weight: 600;
		color: var(--main-green);
		white-space: nowrap;
	}
	.info-panel dd {
		margin: 0;
		color: var(--paragraph-colour);
		opacity: 0.85;
	}
	/* Term/definition side by side needs more width than a phone has. */
	@media (max-width: 540px) {
		.card { padding: var(--space-4); }
		.info-panel dl { grid-template-columns: minmax(0, 1fr); }
		.info-panel dd { margin-bottom: var(--space-2); }
	}
</style>
