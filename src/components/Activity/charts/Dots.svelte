<!--
    Point markers inside a ChartFrame plot, drawn as HTML.

    An SVG circle inside the plots' stretched viewBox comes out as an
    ellipse (or a dash, on a wide card). As positioned boxes they stay round.

    Props
      points  [{ x, y }] in viewBox units
      width   viewBox width
      height  viewBox height
      size    diameter in px (6)
      color   CSS colour (var(--series-3))
-->
<script>
    let { points = [], width, height, size = 6, color = "var(--series-3)" } = $props();
</script>

<div class="dots" aria-hidden="true" style:--size="{size}px" style:--c={color}>
    {#each points as p, i (i)}
        <span style:left="{(p.x / width) * 100}%" style:bottom="{100 - (p.y / height) * 100}%"></span>
    {/each}
</div>

<style>
    .dots { position: absolute; inset: 0; pointer-events: none; }
    span {
        position: absolute;
        width: var(--size);
        height: var(--size);
        margin: 0 0 calc(var(--size) / -2) calc(var(--size) / -2);
        border-radius: 50%;
        background: var(--c);
        opacity: 0.55;
    }
</style>
