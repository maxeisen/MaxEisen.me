<!--
    Axes and gridlines around a plot.

    The charts here draw into a fixed viewBox and stretch to their container,
    which is what keeps them free of resize observers — but it also means
    anything drawn inside the SVG is scaled non-uniformly, so axis text can't
    live there without being stretched. Both axes are therefore HTML, placed by
    percentage: the y labels against the plot's height, the x labels against
    its width, with the gridlines drawn in their own SVG layer at the same
    fractions so the numbers and the lines can't disagree.

    The x labels are absolutely positioned inside a clipped track rather than
    laid out in flow. In flow they can't shrink below their own text, and a row
    of nowrap dates will happily make a card wider than a phone — which is
    exactly what it did (see e2e/training.e2e.js).
-->
<script>
	let {
		/** Plot height in px. */
		height = 180,
		/** From axisTicks(): [{ value, label, pct }], pct measured from the bottom. */
		yTicks = [],
		/** [{ key, label, pct, anchor: "start" | "middle" | "end" }] */
		xTicks = [],
		/** Describes the plot for screen readers. */
		label = "",
		children,
	} = $props();
</script>

<figure class="frame" style="--plot-height: {height}px" role="img" aria-label={label}>
	<div class="y-axis" aria-hidden="true">
		{#each yTicks as tick (tick.value)}
			<span style="bottom: {tick.pct}%">{tick.label}</span>
		{/each}
	</div>

	<div class="plot">
		<svg class="grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
			{#each yTicks as tick (tick.value)}
				<line class:base={tick.value === 0} x1="0" x2="100" y1={100 - tick.pct} y2={100 - tick.pct} />
			{/each}
		</svg>
		{@render children()}
	</div>

	{#if xTicks.length}
		<div class="x-axis" aria-hidden="true">
			{#each xTicks as tick (tick.key)}
				<span
					class={tick.anchor}
					style={tick.anchor === "start"
						? "left: 0"
						: tick.anchor === "end"
							? "right: 0"
							: `left: ${tick.pct}%`}
				>{tick.label}</span>
			{/each}
		</div>
	{/if}
</figure>

<style>
	.frame {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		column-gap: var(--space-2);
		margin: 0;
	}

	.y-axis {
		grid-column: 1;
		grid-row: 1;
		position: relative;
		height: var(--plot-height);
		/* Reserve the label column without measuring: four characters of
		   0.7rem digits, which covers "1.30" and "-20". */
		min-width: 2.1rem;
	}
	.y-axis span {
		position: absolute;
		right: 0;
		transform: translateY(50%);
		font-size: var(--font-2xs);
		font-variant-numeric: tabular-nums;
		color: var(--paragraph-colour);
		opacity: 0.55;
		white-space: nowrap;
	}

	.plot {
		grid-column: 2;
		grid-row: 1;
		position: relative;
		height: var(--plot-height);
		min-width: 0;
	}
	.plot :global(svg) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		overflow: visible;
	}
	.grid line {
		stroke: var(--paragraph-colour);
		stroke-width: 1;
		opacity: 0.12;
		vector-effect: non-scaling-stroke;
	}
	/* Zero is a reference, not a gridline — it wants to read as the floor. */
	.grid line.base { opacity: 0.28; }

	.x-axis {
		grid-column: 2;
		grid-row: 2;
		position: relative;
		height: 1.3em;
		margin-top: var(--space-2);
		overflow: hidden;
	}
	.x-axis span {
		position: absolute;
		top: 0;
		font-size: var(--font-2xs);
		color: var(--paragraph-colour);
		opacity: 0.6;
		white-space: nowrap;
	}
	.x-axis span.middle { transform: translateX(-50%); }
</style>
