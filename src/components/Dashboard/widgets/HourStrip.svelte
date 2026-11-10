<!--
	The next hours of the forecast, one column each: time, sky, temperature,
	and the chance of rain when it's worth mentioning. Shows as many hours as
	fit across, about one per 52px, so a wider tile simply sees further.
-->
<script>
	import { describeCode } from "../lib/weatherFeed.svelte.js";

	let { hours = [], count = 12 } = $props();

	function label(hour) {
		if (hour === 0) return "12am";
		if (hour === 12) return "12pm";
		return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
	}
</script>

<div class="hours-wrap">
	<ol class="hours">
		{#each hours.slice(0, count) as h, i (h.time)}
			<li class="hour">
				<span class="hour-time">{i === 0 ? "Now" : label(h.hour)}</span>
				<span class="hour-sky" title={describeCode(h.code).label}>{describeCode(h.code).emoji}</span>
				<span class="hour-temp">{Number.isFinite(h.temp) ? `${Math.round(h.temp)}°` : "—"}</span>
				<span class="hour-rain">{h.precip >= 20 ? `${Math.round(h.precip)}%` : ""}</span>
			</li>
		{/each}
	</ol>
</div>

<style>
	/* Its own width container: the strip sits in tiles of every size, and
	   what matters is how many ~52px columns fit across it. */
	.hours-wrap { container: hours / inline-size; }
	.hours {
		display: flex;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.hour {
		display: flex;
		flex: 1 1 0;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		min-width: 0;
		font-variant-numeric: tabular-nums;
	}
	.hour-time { font-size: var(--font-2xs); color: var(--text-2); white-space: nowrap; }
	.hour-sky { font-size: 1.05rem; line-height: 1.3; }
	.hour-temp { font-size: var(--font-sm); font-weight: var(--weight-semibold); color: var(--text-strong); }
	.hour-rain { min-height: 1em; font-size: var(--font-2xs); color: var(--series-2); }
	@container hours (max-width: 623px) { .hour:nth-child(n + 12) { display: none; } }
	@container hours (max-width: 571px) { .hour:nth-child(n + 11) { display: none; } }
	@container hours (max-width: 519px) { .hour:nth-child(n + 10) { display: none; } }
	@container hours (max-width: 467px) { .hour:nth-child(n + 9) { display: none; } }
	@container hours (max-width: 415px) { .hour:nth-child(n + 8) { display: none; } }
	@container hours (max-width: 363px) { .hour:nth-child(n + 7) { display: none; } }
	@container hours (max-width: 311px) { .hour:nth-child(n + 6) { display: none; } }
	@container hours (max-width: 259px) { .hour:nth-child(n + 5) { display: none; } }
	@container hours (max-width: 207px) { .hour:nth-child(n + 4) { display: none; } }
</style>
