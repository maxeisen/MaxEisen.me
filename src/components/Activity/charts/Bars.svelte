<!--
    Columns inside a ChartFrame plot, drawn as HTML rather than SVG.

    The plots stretch a fixed viewBox to whatever width the card has, which
    turns an SVG rect's rounded corners into smears and lets a column grow
    as wide as its slot. As boxes positioned in percentages, a column keeps
    a fixed maximum width and a true 4px rounded top at any size.

    Props
      layout    bars() output: [{ x, width, y, height, value }] in viewBox units
      width     viewBox width the layout was computed in
      height    viewBox height
      colorFor  (i) => CSS colour for column i (defaults to --series-1)
      targets   optional [y | null] in viewBox units — a tick across column i
      max       widest a column may draw, in px (24)
-->
<script>
    let { layout = [], width, height, colorFor = () => null, targets = [], max = 24 } = $props();

    const pct = (v, of) => (of > 0 ? (v / of) * 100 : 0);
</script>

<div class="bars" aria-hidden="true">
    {#each layout as bar, i (i)}
        <div
            class="col"
            style:left="{pct(bar.x + bar.width / 2, width)}%"
            style:width="min({max}px, {pct(bar.width, width)}%)"
        >
            {#if bar.height > 0}
                <div class="bar" style:height="{pct(bar.height, height)}%" style:--bar={colorFor(i)}></div>
            {/if}
            {#if Number.isFinite(targets[i])}
                <div class="target" style:bottom="{100 - pct(targets[i], height)}%"></div>
            {/if}
        </div>
    {/each}
</div>

<style>
    .bars {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }
    .col {
        position: absolute;
        top: 0;
        bottom: 0;
        transform: translateX(-50%);
    }
    .bar {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        min-height: 2px;
        border-radius: 4px 4px 0 0;
        background: var(--bar, var(--series-1));
    }
    .target {
        position: absolute;
        left: -3px;
        right: -3px;
        height: 2px;
        margin-bottom: -1px;
        border-radius: 1px;
        background: var(--text-strong);
    }
</style>
