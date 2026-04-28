#!/usr/bin/env python3
"""Generate the ME monogram favicons and PWA icons from the bundled Fraunces font.

Run:
    pip install Pillow fonttools brotli
    python3 scripts/generate_logo_icons.py

Outputs:
    public/img/icons/site-icons/icon-192.png
    public/img/icons/site-icons/icon-512.png
    public/img/icons/site-icons/apple_touch_icon.png
    public/favicon-16.png
    public/favicon-32.png
    public/favicon.ico
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
    from fontTools.ttLib import TTFont
except ImportError:
    sys.exit("fonttools required: pip install fonttools brotli")

ROOT = Path(__file__).resolve().parent.parent
WOFF2 = ROOT / "public" / "fonts" / "fraunces-latin.woff2"
SITE_ICONS = ROOT / "public" / "img" / "icons" / "site-icons"
PUBLIC = ROOT / "public"

FG = (28, 26, 23, 255)      # warm dark — text
BG = (184, 168, 136, 255)   # sand — circle


def woff2_to_ttf(woff2_path: Path) -> Path:
    """Cloudinary, GitHub, etc. serve fonts as woff2; PIL only loads ttf/otf."""
    font = TTFont(woff2_path)
    font.flavor = None
    out = Path(tempfile.gettempdir()) / "fraunces-latin.ttf"
    font.save(out)
    return out


def make_logo(size: int, font_path: Path, padding_ratio: float = 0.04) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = max(1, int(size * padding_ratio))
    draw.ellipse([(pad, pad), (size - pad, size - pad)], fill=BG)

    font = ImageFont.truetype(str(font_path), int(size * 0.5))
    text = "ME"
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (size - w) / 2 - bbox[0]
    # Optical centering: serif glyphs sit a touch low.
    y = (size - h) / 2 - bbox[1] - size * 0.02
    draw.text((x, y), text, font=font, fill=FG)
    return img


def main() -> int:
    if not WOFF2.exists():
        print(f"missing {WOFF2}", file=sys.stderr)
        return 1
    ttf = woff2_to_ttf(WOFF2)

    targets = [
        (192, SITE_ICONS / "icon-192.png"),
        (512, SITE_ICONS / "icon-512.png"),
        (180, SITE_ICONS / "apple_touch_icon.png"),
        (32, PUBLIC / "favicon-32.png"),
        (16, PUBLIC / "favicon-16.png"),
    ]
    for size, path in targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        make_logo(size, ttf).save(path)
        print(f"wrote {path.relative_to(ROOT)} ({size}x{size})")

    # Multi-size .ico for legacy compat.
    ico_path = PUBLIC / "favicon.ico"
    make_logo(48, ttf).save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"wrote {ico_path.relative_to(ROOT)} (16/32/48)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
