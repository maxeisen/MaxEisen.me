<!--
    The site mark: a lowercase "me." on a rounded ink square, the period in
    the accent. The letters are Inter's own outlines (logoGlyphs.js, generated
    with the favicons by scripts/generate_logo_icons.py), so the nav, the tab
    icon and the home-screen icon are the same drawing.

    In each theme the square takes the strongest ink and the letters the page
    colour, so it inverts with the theme; the period uses the accent that
    reads on that square (--logo-* in global.css).
-->
<script>
    import { LOGO_BOX, LOGO_RADIUS, LOGO_LETTERS, LOGO_DOT } from "./logoGlyphs.js";

    let { size = 28, title = null } = $props();
</script>

<svg
    class="logo"
    viewBox="0 0 {LOGO_BOX} {LOGO_BOX}"
    width={size}
    height={size}
    role={title ? "img" : undefined}
    aria-label={title ?? undefined}
    aria-hidden={title ? undefined : "true"}
>
    <rect width={LOGO_BOX} height={LOGO_BOX} rx={LOGO_RADIUS} class="square" />
    <path d={LOGO_LETTERS} class="letters" />
    <path d={LOGO_DOT} class="dot" />
</svg>

<style>
    .logo { display: block; flex: none; }
    .square { fill: var(--logo-bg); }
    .letters { fill: var(--logo-fg); }
    .dot { fill: var(--logo-dot); }
</style>
