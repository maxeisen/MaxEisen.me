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
    from PIL import Image
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path, help="Source image (PNG or WEBP)")
    parser.add_argument("--to", dest="new_color", type=parse_hex, required=True, help="New border color, hex e.g. #b8a888")
    parser.add_argument("--from", dest="src_color", type=parse_hex, default=None, help="Source border color (auto-detected if omitted)")
    parser.add_argument("--tolerance", type=int, default=80, help="Color match tolerance per channel (default: 80)")
    parser.add_argument("--webp-quality", type=int, default=90, help="WEBP quality 0-100 (default: 90)")
    parser.add_argument("--no-webp", action="store_true", help="Skip writing the .webp variant")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"error: input not found: {args.input}", file=sys.stderr)
        return 1

    im = Image.open(args.input)
    src = args.src_color or detect_border_color(im)
    print(f"source border color: #{src[0]:02x}{src[1]:02x}{src[2]:02x}")
    print(f"new border color:    #{args.new_color[0]:02x}{args.new_color[1]:02x}{args.new_color[2]:02x}")

    out, count = recolor(im, src, args.new_color, args.tolerance)
    print(f"recolored {count:,} pixels")

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
