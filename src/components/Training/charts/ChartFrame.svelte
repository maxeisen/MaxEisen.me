<!--
    Axes, gridlines and a scrub cursor around a plot.

    The charts here draw into a fixed viewBox and stretch to their container,
    which is what keeps them free of resize observers — but it also means
    anything drawn inside the SVG is scaled non-uniformly, so axis text can't
    live there without being stretched. Both axes are therefore HTML, placed by
    percentage: the y labels against the plot's height, the x labels against
    its width, with the gridlines drawn in their own SVG layer at the same
    fractions so the numbers and the lines can't disagree. The cursor and its
    readout are HTML for the same reason.

    The x labels are absolutely positioned inside a clipped track rather than
    laid out in flow. In flow they can't shrink below their own text, and a row
    of nowrap dates will happily make a card wider than a phone — which is
    exactly what it did (see e2e/training.e2e.js).

    Scrubbing is optional and lives here rather than in each chart, so that a
    line chart, a bar chart and a scatter all answer a hover the same way. A
    chart passes what its points mean — a label and some readouts, positioned
    as percentages — and gets the cursor, the dots, the tooltip and the
    keyboard handling for it.
-->
<script>
	let {
		/** Plot height in px. */
		height = 180,
		/** From axisTicks(): [{ value, label, pct }], pct measured from the bottom. */
		yTicks = [],
		/** [{ key, label, pct, anchor: "start" | "middle" | "end" }] */
		xTicks = [],
		/**
		 * Scrubbable points, ascending by pct:
		 * [{ key, pct, label, readouts: [{ label, value, colour, yPct }] }]
		 *
		 * pct is measured from the left of the plot and yPct from its bottom,
		 * so a chart converts once from its own viewBox and this stays free of
		 * any chart's geometry.
		 */
		scrub = [],
		/** Describes the plot for screen readers. */
		label = "",
		children,
	} = $props();

	let plot = $state(null);
	let active = $state(-1);

	// One point is a dot, not a series: there's nothing to move between.
	const scrubbable = $derived(scrub.length > 1);
	const current = $derived(scrubbable && active >= 0 ? scrub[active] || null : null);

	// Nearest by position rather than by slot width, because bars sit at slot
	// centres and line points sit at the edges — measuring the gap works for
	// both without either chart having to say which it is.
	function nearest(clientX) {
		const box = plot?.getBoundingClientRect();
		if (!box?.width) return -1;
		const pct = ((clientX - box.left) / box.width) * 100;
		let best = 0;
		let smallest = Infinity;
		for (const [i, point] of scrub.entries()) {
			const gap = Math.abs(point.pct - pct);
			if (gap < smallest) {
				smallest = gap;
				best = i;
			}
		}
		return best;
	}

	function track(event) {
		if (scrubbable) active = nearest(event.clientX);
	}

	function clear() {
		active = -1;
	}

	// Focus lands on the most recent point rather than the oldest: every chart
	// here runs left to right into today, and the right-hand end is the one
	// worth reading first.
	function focus() {
		if (scrubbable && active < 0) active = scrub.length - 1;
	}

	const STEPS = {
		ArrowRight: 1,
		ArrowUp: 1,
		ArrowLeft: -1,
		ArrowDown: -1,
	};

	function key(event) {
		if (!scrubbable) return;

		if (event.key === "Escape") {
			event.preventDefault();
			active = -1;
			return;
		}

		const last = scrub.length - 1;
		const from = active < 0 ? last : active;

		let next;
		if (event.key in STEPS) next = from + STEPS[event.key];
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = last;
		else return;

		// Only once it's certainly ours: arrow keys still have to scroll the
		// page when the cursor isn't what they're aimed at.
		event.preventDefault();
		// Clamped, not wrapped or dismissed: stepping past the first point
		// used to clear the cursor, which reads as the chart having lost you.
		active = Math.min(last, Math.max(0, next));
	}

	// Beside the cursor, on whichever side has more room — never centred over
	// it. Centred, the readout covers the very dots it's describing, and it
	// also hangs off the edge at the ends of the series, which on a phone is
	// enough to make the whole page scroll sideways.
	const tipStyle = $derived.by(() => {
		if (!current) return "";
		return current.pct < 50
			? `left: calc(${current.pct}% + 10px)`
			: `right: calc(${100 - current.pct}% + 10px)`;
	});

	// What a screen reader hears as the cursor moves, since it can't see the
	// dots: the same sentence the tooltip shows, read out.
	const spoken = $derived(
		current
			? `${current.label}. ${current.readouts.map((r) => `${r.label} ${r.value}`).join(", ")}`
			: "",
	);
</script>

<figure
	class="frame"
	style="--plot-height: {height}px"
	role={scrubbable ? undefined : "img"}
	aria-label={scrubbable ? undefined : label}
>
	<div class="y-axis" aria-hidden="true">
		{#each yTicks as tick (tick.value)}
			<span style="bottom: {tick.pct}%">{tick.label}</span>
		{/each}
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="plot"
		class:scrubbable
		bind:this={plot}
		role={scrubbable ? "slider" : undefined}
		aria-label={scrubbable ? label : undefined}
		aria-valuemin={scrubbable ? 0 : undefined}
		aria-valuemax={scrubbable ? scrub.length - 1 : undefined}
		aria-valuenow={scrubbable ? Math.max(0, active) : undefined}
		aria-valuetext={scrubbable ? spoken || label : undefined}
		tabindex={scrubbable ? 0 : undefined}
		onpointermove={track}
		onpointerleave={clear}
		onpointercancel={clear}
		onfocus={focus}
		onblur={clear}
		onkeydown={key}
	>
		<svg class="grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
			{#each yTicks as tick (tick.value)}
				<line class:base={tick.value === 0} x1="0" x2="100" y1={100 - tick.pct} y2={100 - tick.pct} />
			{/each}
		</svg>
		{@render children()}

		{#if current}
			<div class="cursor" style="left: {current.pct}%" aria-hidden="true"></div>
			{#each current.readouts as readout (readout.label)}
				{#if Number.isFinite(readout.yPct)}
					<span
						class="dot"
						style="left: {current.pct}%; bottom: {readout.yPct}%; --dot: {readout.colour ||
							'var(--main-green)'}"
						aria-hidden="true"
					></span>
				{/if}
			{/each}
			<div class="tip" style={tipStyle} aria-hidden="true">
				<p class="tip-label">{current.label}</p>
				<dl>
					{#each current.readouts as readout (readout.label)}
						<div>
							<dt>
								{#if readout.colour}
									<span class="swatch" style="--dot: {readout.colour}"></span>
								{/if}
								{readout.label}
							</dt>
							<dd>{readout.value}</dd>
						</div>
					{/each}
				</dl>
			</div>
		{/if}
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
	.plot.scrubbable {
		/* The cursor is the affordance — there's nothing to click. */
		cursor: crosshair;
		touch-action: pan-y;
	}
	.plot:focus { outline: none; }
	.plot:focus-visible {
		outline: 2px solid var(--main-green);
		outline-offset: 4px;
		border-radius: var(--radius-sm);
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

	.cursor {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--paragraph-colour);
		opacity: 0.45;
		pointer-events: none;
	}
	.dot {
		position: absolute;
		width: 9px;
		height: 9px;
		margin: 0 0 -4.5px -4.5px;
		border-radius: 50%;
		background: var(--dot);
		/* Ringed in the card's own background so a dot stays legible where it
		   sits on top of the line it belongs to. */
		/* Ringed in an opaque surface so a dot stays legible where it sits on
		   top of the line it belongs to. */
		box-shadow: 0 0 0 2px var(--background-one);
		pointer-events: none;
	}

	.tip {
		position: absolute;
		top: 0;
		z-index: 2;
		min-width: max-content;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		/* The card surface tint composited over an opaque base, rather than
		   used alone: --inner-background is 28% alpha on the dark theme, which
		   is fine for a panel sitting on the page background and unreadable
		   for a label sitting on top of the chart it's describing. */
		background:
			linear-gradient(var(--inner-background), var(--inner-background)),
			var(--background-one);
		border: 1px solid var(--main-green-translucent);
		box-shadow: var(--box-shadow, 0 4px 16px rgb(0 0 0 / 18%));
		pointer-events: none;
	}
	.tip-label {
		margin: 0 0 var(--space-1) 0;
		font-size: var(--font-2xs);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--main-green);
		white-space: nowrap;
	}
	.tip dl {
		display: grid;
		gap: 2px;
		margin: 0;
	}
	.tip dl div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.tip dt {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: var(--font-2xs);
		color: var(--paragraph-colour);
		opacity: 0.75;
		white-space: nowrap;
	}
	.tip dd {
		margin: 0;
		font-size: var(--font-xs);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		color: var(--header-colour);
		white-space: nowrap;
	}
	.swatch {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		background: var(--dot);
		flex: none;
	}

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
