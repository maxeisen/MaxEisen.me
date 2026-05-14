#!/usr/bin/env python3
"""Recolor the circular border around a headshot image.

Replaces every pixel matching a target border color (within a tolerance) with
a new color, preserving the original alpha channel so anti-aliased edges still
look smooth. Writes both PNG and WEBP variants alongside the source.

Examples
--------
Recolor with auto-detected border color (uses the most common saturated color):

    python3 scripts/recolor_headshot_border.py public/img/headshots/amazon_2026.png \
        --to "#b8a888"

Specify the source border color explicitly:

    python3 scripts/recolor_headshot_border.py public/img/headshots/amazon_2026.png \
        --from "#00ffe2" --to "#b8a888" --tolerance 80
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageDraw, ImageFilter
except ImportError:
    sys.exit("PIL/Pillow required. Install with: pip install Pillow")


def parse_hex(value: str) -> tuple[int, int, int]:
    v = value.lstrip("#")
    if len(v) != 6:
        raise argparse.ArgumentTypeError(f"expected 6-digit hex (e.g. #ff5500), got {value!r}")
    return int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)


def detect_border_color(im: Image.Image, min_saturation: int = 120) -> tuple[int, int, int]:
    """Return the most common saturated, opaque color — usually the border."""
    im = im.convert("RGBA")
    pixel_counts = im.getcolors(maxcolors=im.size[0] * im.size[1])
    if not pixel_counts:
        raise RuntimeError("could not enumerate image colors (image too large)")
    # Sort by frequency, look for first saturated, opaque color
    pixel_counts.sort(key=lambda x: x[0], reverse=True)
    for count, (r, g, b, a) in pixel_counts:
        if a < 240:
            continue
        # Saturation proxy: max channel - min channel
        if max(r, g, b) - min(r, g, b) >= min_saturation:
            return r, g, b
    raise RuntimeError("no saturated color found — pass --from explicitly")


def recolor(im: Image.Image, target: tuple[int, int, int], new: tuple[int, int, int], tolerance: int) -> tuple[Image.Image, int]:
    im = im.convert("RGBA")
    pixels = im.load()
    w, h = im.size
    tr, tg, tb = target
    nr, ng, nb = new
    count = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if abs(r - tr) < tolerance and abs(g - tg) < tolerance and abs(b - tb) < tolerance:
                pixels[x, y] = (nr, ng, nb, a)
                count += 1
    return im, count


def _channel_range_mask(ch: Image.Image, target: int, tolerance: int) -> Image.Image:
    lo = ch.point(lambda v: 255 if v >= target - tolerance else 0)
    hi = ch.point(lambda v: 255 if v <= target + tolerance else 0)
    return ImageChops.multiply(lo, hi)


def thicken_border(im: Image.Image, color: tuple[int, int, int], thickness: int, tolerance: int,
                   direction: str = "outward") -> tuple[Image.Image, int]:
    """Grow the headshot's circular border ring by `thickness` pixels, filling
    the expanded annulus with solid `color` at full alpha.

    `direction` controls which edge grows:
      - "outward": only the outer edge moves out — the inner photo is never
        touched (recommended).
      - "inward":  only the inner edge moves in — eats into the inner photo
        but covers the original template's antialiased face fringe.
      - "both":    grows on both sides.

    The ring is found *geometrically* — by walking radially from the image
    edge inward to locate the inner edge of the border, and outward from
    center to locate the outer edge. A color-only mask doesn't work here
    because typical skin tones and warm backgrounds in the new inner photo
    often match the border color within any reasonable tolerance.
    """
    im = im.convert("RGBA")
    w, h = im.size
    cx, cy = w // 2, h // 2
    px = im.load()
    tr, tg, tb = color

    def is_border(r: int, g: int, b: int) -> bool:
        return abs(r - tr) < tolerance and abs(g - tg) < tolerance and abs(b - tb) < tolerance

    def scan_inner(dx: int, dy: int) -> int | None:
        max_d = (w if dx else h) // 2
        seen_border = False
        for d in range(max_d, 0, -1):
            x = cx + dx * d
            y = cy + dy * d
            if not (0 <= x < w and 0 <= y < h):
                continue
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            if is_border(r, g, b):
                seen_border = True
                continue
            if seen_border:
                return d
        return None

    def scan_outer(dx: int, dy: int) -> int | None:
        max_d = (w if dx else h) // 2
        last = None
        for d in range(1, max_d):
            x = cx + dx * d
            y = cy + dy * d
            if not (0 <= x < w and 0 <= y < h):
                continue
            r, g, b, a = px[x, y]
            if a > 200:
                last = d
        return last

    inner_candidates = [scan_inner(1, 0), scan_inner(-1, 0), scan_inner(0, 1), scan_inner(0, -1)]
    outer_candidates = [scan_outer(1, 0), scan_outer(-1, 0), scan_outer(0, 1), scan_outer(0, -1)]
    inner_r = min((c for c in inner_candidates if c is not None), default=None)
    outer_r = max((c for c in outer_candidates if c is not None), default=None)
    if inner_r is None or outer_r is None:
        raise RuntimeError("could not detect ring radii; image isn't recognizably circular")

    new_inner = max(0, inner_r - thickness) if direction in ("inward", "both") else inner_r
    new_outer = outer_r + thickness if direction in ("outward", "both") else outer_r

    # Annulus = filled outer disc minus filled inner disc, drawn into an L mask.
    annulus = Image.new("L", im.size, 0)
    draw = ImageDraw.Draw(annulus)
    draw.ellipse([cx - new_outer, cy - new_outer, cx + new_outer, cy + new_outer], fill=255)
    draw.ellipse([cx - new_inner, cy - new_inner, cx + new_inner, cy + new_inner], fill=0)

    overlay = Image.new("RGBA", im.size, (tr, tg, tb, 255))
    return Image.composite(overlay, im, annulus), thickness


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path, help="Source image (PNG or WEBP)")
    parser.add_argument("--to", dest="new_color", type=parse_hex, default=None, help="New border color, hex e.g. #b8a888 (omit to keep source color and only thicken)")
    parser.add_argument("--from", dest="src_color", type=parse_hex, default=None, help="Source border color (auto-detected if omitted)")
    parser.add_argument("--tolerance", type=int, default=80, help="Color match tolerance per channel (default: 80)")
    parser.add_argument("--thicken", type=int, default=0, help="Grow the border ring by N pixels to bury antialiased fringe (default: 0)")
    parser.add_argument(
        "--thicken-direction", choices=["outward", "inward", "both"], default="outward",
        help="Where to grow the ring: outward (default, leaves inner photo untouched), inward (eats into photo), or both",
    )
    parser.add_argument("--webp-quality", type=int, default=90, help="WEBP quality 0-100 (default: 90)")
    parser.add_argument("--no-webp", action="store_true", help="Skip writing the .webp variant")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"error: input not found: {args.input}", file=sys.stderr)
        return 1
    if args.new_color is None and args.thicken <= 0:
        print("error: pass --to to recolor and/or --thicken N to grow the border", file=sys.stderr)
        return 1

    im = Image.open(args.input)
    src = args.src_color or detect_border_color(im)
    new = args.new_color or src
    print(f"source border color: #{src[0]:02x}{src[1]:02x}{src[2]:02x}")

    if args.new_color and args.new_color != src:
        print(f"new border color:    #{new[0]:02x}{new[1]:02x}{new[2]:02x}")
        out, count = recolor(im, src, new, args.tolerance)
        print(f"recolored {count:,} pixels")
    else:
        # No --to passed → don't touch any pixels yet. The recolor pass would
        # collapse near-matches to the exact source colour, which color-washes
        # warm skin/hair tones in the new inner photo.
        out = im

    if args.thicken > 0:
        out, _ = thicken_border(out, new, args.thicken, args.tolerance, args.thicken_direction)
        print(f"thickened border ({args.thicken_direction}) by {args.thicken}px")

    png_path = args.input.with_suffix(".png")
    out.save(png_path)
    print(f"wrote {png_path}")

    if not args.no_webp:
        webp_path = args.input.with_suffix(".webp")
        out.save(webp_path, "WEBP", quality=args.webp_quality, method=6)
        print(f"wrote {webp_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
