#!/usr/bin/env python3
"""
Generate the "me." mark everywhere it's drawn, from the site's own Inter.

The mark is a lowercase "me." on an ink square, the period in sage. The
glyph outlines come from public/fonts/inter-latin.woff2 (instanced at the
weight below), so the logo is the site's typeface rather than a second one,
and nothing that shows it — a browser tab, a home screen — needs the font.

Run:
    pip install fonttools brotli Pillow
    python3 scripts/generate_logo_icons.py

Outputs:
    src/lib/ui/logoGlyphs.js        outlines for the nav logo (Logo.svelte)
    public/favicon.svg              tab icon, vector (heavier cut for 16 px)
    public/img/logo.svg             the mark as designed, for anywhere else
    public/favicon-16.png, favicon-32.png, favicon.ico
    public/img/icons/site-icons/apple_touch_icon.png   full-bleed (iOS rounds it)
    public/img/icons/site-icons/icon-192.png, icon-512.png   full-bleed, maskable-safe
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Pillow required: pip install Pillow")

try:
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
except ImportError:
    sys.exit("fonttools required: pip install fonttools brotli")

ROOT = Path(__file__).resolve().parent.parent
WOFF2 = ROOT / "public" / "fonts" / "inter-latin.woff2"
SITE_ICONS = ROOT / "public" / "img" / "icons" / "site-icons"
PUBLIC = ROOT / "public"
GLYPHS_JS = ROOT / "src" / "lib" / "ui" / "logoGlyphs.js"

WEIGHT = 650          # the mark as the nav and home-screen icons draw it
TAB_WEIGHT = 780      # browser-tab sizes: heavier, so 16 px still reads
TEXT = "me."
# Fixed colours: an icon has no theme. These are the light theme's ink and
# paper (global.css --logo-*), with the dark theme's sage for the period so it
# reads on the ink.
INK = "#15130f"
PAPER = "#f4efe6"
SAGE = "#a9bf8c"

BOX = 64           # viewBox units
RADIUS = 15        # corner radius on the rounded square
TRACKING = -0.035  # em, tightened the way a display setting would be


def instanced_font(weight: int) -> tuple[TTFont, Path]:
    """Inter at one weight, plus a .ttf copy on disk for Pillow."""
    font = TTFont(WOFF2)
    if "fvar" in font:
        font = instantiateVariableFont(font, {"wght": weight})
    font.flavor = None
    ttf = Path(tempfile.gettempdir()) / f"inter-logo-{weight}.ttf"
    font.save(ttf)
    return TTFont(ttf), ttf


def layout(font: TTFont, width_ratio: float):
    """
    Lay out TEXT as glyph placements in BOX units.

    The word is scaled to width_ratio of BOX, centred horizontally, with its
    x-height centred vertically.
    """
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    upm = font["head"].unitsPerEm
    x_height = font["OS/2"].sxHeight or int(upm * 0.53)

    names = [cmap[ord(ch)] for ch in TEXT]
    tracking = TRACKING * upm
    advances = [glyphs[n].width + tracking for n in names]
    # Ink width: drop the trailing side bearing + tracking of the last glyph.
    total = sum(advances[:-1]) + glyphs[names[-1]].width
    scale = (BOX * width_ratio) / total

    x0 = (BOX - total * scale) / 2
    baseline = BOX / 2 + (x_height * scale) / 2
    placed, x = [], x0
    for name, adv in zip(names, advances):
        placed.append((name, x))
        x += adv * scale
    return glyphs, placed, scale, baseline


def svg_paths(font: TTFont, width_ratio: float) -> tuple[str, str]:
    """(letters, period) as SVG path data in BOX units."""
    glyphs, placed, scale, baseline = layout(font, width_ratio)
    letters, dot = [], ""
    for i, (name, x) in enumerate(placed):
        pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        if i == len(placed) - 1:
            dot = pen.getCommands()
        else:
            letters.append(pen.getCommands())
    return " ".join(letters), dot


def svg_document(letters: str, dot: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {BOX} {BOX}">\n'
        f'    <rect width="{BOX}" height="{BOX}" rx="{RADIUS}" fill="{INK}"/>\n'
        f'    <path fill="{PAPER}" d="{letters}"/>\n'
        f'    <path fill="{SAGE}" d="{dot}"/>\n'
        "</svg>\n"
    )


def raster(ttf_path: Path, font: TTFont, size: int, rounded: bool, width_ratio: float) -> Image.Image:
    """Draw the mark at `size` px, supersampled for clean small sizes."""
    ss = 8 if size < 64 else 4
    big = size * ss
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if rounded:
        draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=big * RADIUS / BOX, fill=INK)
    else:
        draw.rectangle([0, 0, big, big], fill=INK)

    _, placed, scale, baseline = layout(font, width_ratio)
    upm = font["head"].unitsPerEm
    k = big / BOX
    pil_font = ImageFont.truetype(str(ttf_path), round(upm * scale * k))
    for i, (_, x) in enumerate(placed):
        ch = TEXT[i]
        draw.text((x * k, baseline * k), ch, font=pil_font, fill=SAGE if ch == "." else PAPER, anchor="ls")
    return img.resize((size, size), Image.LANCZOS)


def main() -> int:
    if not WOFF2.exists():
        print(f"missing {WOFF2}", file=sys.stderr)
        return 1
    font, ttf = instanced_font(WEIGHT)
    tab_font, tab_ttf = instanced_font(TAB_WEIGHT)

    # Vector. logo.svg is the mark as designed; favicon.svg is what a browser
    # tab draws at 16 px, so it uses the heavier tab cut and larger letters.
    letters, dot = svg_paths(font, 0.74)
    (PUBLIC / "img" / "logo.svg").write_text(svg_document(letters, dot))
    print("wrote public/img/logo.svg")
    tab_letters, tab_dot = svg_paths(tab_font, 0.84)
    (PUBLIC / "favicon.svg").write_text(svg_document(tab_letters, tab_dot))
    print("wrote public/favicon.svg")
    GLYPHS_JS.write_text(
        "// Generated by scripts/generate_logo_icons.py — do not edit by hand.\n"
        "// Outlines of \"me.\" in Inter at weight %d, in a %d-unit box.\n\n"
        "export const LOGO_BOX = %d;\n"
        "export const LOGO_RADIUS = %d;\n"
        "export const LOGO_LETTERS = %r;\n"
        "export const LOGO_DOT = %r;\n" % (WEIGHT, BOX, BOX, RADIUS, letters, dot)
    )
    print(f"wrote {GLYPHS_JS.relative_to(ROOT)}")

    # Tab favicons: rounded, the heavy cut, letters as large as the square allows.
    for size, path in [(32, PUBLIC / "favicon-32.png"), (16, PUBLIC / "favicon-16.png")]:
        raster(tab_ttf, tab_font, size, rounded=True, width_ratio=0.86).save(path)
        print(f"wrote {path.relative_to(ROOT)} ({size}x{size})")
    ico = PUBLIC / "favicon.ico"
    raster(tab_ttf, tab_font, 48, rounded=True, width_ratio=0.86).save(ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"wrote {ico.relative_to(ROOT)} (16/32/48)")

    # Home-screen icons: full-bleed square (the OS applies its own mask);
    # letters kept inside the maskable safe zone (the central 80% circle).
    for size, path in [
        (180, SITE_ICONS / "apple_touch_icon.png"),
        (192, SITE_ICONS / "icon-192.png"),
        (512, SITE_ICONS / "icon-512.png"),
    ]:
        path.parent.mkdir(parents=True, exist_ok=True)
        raster(ttf, font, size, rounded=False, width_ratio=0.56).save(path)
        print(f"wrote {path.relative_to(ROOT)} ({size}x{size})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
