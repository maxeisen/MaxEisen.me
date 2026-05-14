#!/usr/bin/env python3
"""Replace the inner photo of an existing headshot template with a new photo.

Detects the face in the new photo via macOS Vision (Swift), crops a square
around the face with comfortable headroom, resizes to the template's
dimensions, and composites it inside a hard circular mask — fully replacing
whatever was inside the template's border. The template only contributes
its outer ring.

Example
-------
    python3 scripts/replace_headshot_photo.py \\
        --template public/img/headshots/amazon_2026.png \\
        --photo ~/Downloads/5Q9A4650.jpg \\
        --output public/img/headshots/resume_headshot.png \\
        --border "#b8a888"
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageDraw
except ImportError:
    sys.exit("PIL/Pillow required. Install with: pip install Pillow")


SCRIPT_DIR = Path(__file__).resolve().parent
DETECT_FACE_SWIFT = SCRIPT_DIR / "_detect_face.swift"


def parse_hex(value: str) -> tuple[int, int, int]:
    v = value.lstrip("#")
    if len(v) != 6:
        raise argparse.ArgumentTypeError(f"expected 6-digit hex (e.g. #ff5500), got {value!r}")
    return int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)


def detect_face_bbox(photo_path: Path) -> tuple[int, int, int, int] | None:
    """Run the Swift face detector. Returns (x, y, w, h) in pixel coords, or None."""
    if not DETECT_FACE_SWIFT.exists():
        return None
    try:
        # First invocation compiles the .swift file (can take ~30s on cold cache).
        result = subprocess.run(
            ["swift", str(DETECT_FACE_SWIFT), str(photo_path)],
            capture_output=True, text=True, timeout=90,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None
    if result.returncode != 0:
        return None
    parts = result.stdout.strip().split()
    if len(parts) != 4:
        return None
    try:
        return tuple(int(p) for p in parts)  # type: ignore[return-value]
    except ValueError:
        return None


def _channel_range_mask(ch: Image.Image, target: int, tolerance: int) -> Image.Image:
    lo = ch.point(lambda v: 255 if v >= target - tolerance else 0)
    hi = ch.point(lambda v: 255 if v <= target + tolerance else 0)
    return ImageChops.multiply(lo, hi)


def detect_inner_radius(template: Image.Image, border: tuple[int, int, int], tolerance: int) -> tuple[int, int, int]:
    """Find the inner-circle center + radius by scanning radially inward.

    Pure color-match would also catch skin tones near the border color and
    misfire. Instead, from each cardinal direction walk inward: skip
    transparent (outside the circle), then skip border-coloured opaque pixels
    (in the ring), and stop at the first opaque non-border pixel — that's the
    inner edge. Take the minimum of the four radii so the resulting circle is
    safely inside the ring on every axis.
    """
    template = template.convert("RGBA")
    px = template.load()
    w, h = template.size
    tr, tg, tb = border
    cx, cy = w // 2, h // 2

    def is_border(r: int, g: int, b: int) -> bool:
        return abs(r - tr) < tolerance and abs(g - tg) < tolerance and abs(b - tb) < tolerance

    def scan(dx: int, dy: int) -> int | None:
        max_d = (w if dx else h) // 2
        seen_border = False
        for d in range(max_d, 0, -1):
            x = cx + dx * d
            y = cy + dy * d
            if not (0 <= x < w and 0 <= y < h):
                continue
            r, g, b, a = px[x, y]
            if a < 200:
                continue  # outside the circle or anti-aliased edge
            if is_border(r, g, b):
                seen_border = True
                continue  # still inside the ring
            if seen_border:
                return d  # first non-border opaque after the ring
        return None

    radii = [r for r in (scan(1, 0), scan(-1, 0), scan(0, 1), scan(0, -1)) if r is not None]
    if not radii:
        return cx, cy, min(w, h) // 2 - 30
    return cx, cy, min(radii)


def square_crop_around_face(photo: Image.Image, face_bbox: tuple[int, int, int, int] | None,
                            padding: float = 2.2, headroom: float = 0.10) -> Image.Image:
    """Crop a square around the face. Falls back to upper-third center if no bbox."""
    w, h = photo.size
    if face_bbox is None:
        # Heuristic: portrait photos generally have the face in the upper third,
        # horizontally centered.
        side = min(w, h)
        cx = w // 2
        cy = int(h * 0.33) if h > w else h // 2
    else:
        fx, fy, fw, fh = face_bbox
        face_dim = max(fw, fh)
        side = int(face_dim * padding)
        cx = fx + fw // 2
        # Shift up slightly so hair / top of head has room.
        cy = fy + fh // 2 - int(face_dim * headroom)

    half = side // 2
    left = max(0, cx - half)
    top = max(0, cy - half)
    right = min(w, left + side)
    bottom = min(h, top + side)
    # If we clipped on one side, recompute so output is square.
    side = min(right - left, bottom - top)
    right = left + side
    bottom = top + side
    return photo.crop((left, top, right, bottom))


def replace_inner(template: Image.Image, photo: Image.Image, face_bbox: tuple[int, int, int, int] | None,
                  border: tuple[int, int, int], tolerance: int) -> Image.Image:
    template = template.convert("RGBA")
    cropped = square_crop_around_face(photo.convert("RGB"), face_bbox)
    sized = cropped.resize(template.size, Image.LANCZOS).convert("RGBA")

    cx, cy, inner_r = detect_inner_radius(template, border, tolerance)

    # Hard circular mask of inner radius — everything inside is the new photo.
    circle_mask = Image.new("L", template.size, 0)
    ImageDraw.Draw(circle_mask).ellipse(
        [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], fill=255
    )

    # Composite: new photo where mask = 255, template elsewhere.
    return Image.composite(sized, template, circle_mask)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--template", type=Path, required=True, help="Existing headshot to copy the border from")
    parser.add_argument("--photo", type=Path, required=True, help="New photo to drop into the inner circle")
    parser.add_argument("--output", type=Path, required=True, help="Output PNG path (a .webp is also written)")
    parser.add_argument("--border", type=parse_hex, default=(0xB8, 0xA8, 0x88), help="Border color hex (default: #b8a888)")
    parser.add_argument("--tolerance", type=int, default=60, help="Border match tolerance per channel (default: 60)")
    parser.add_argument("--padding", type=float, default=2.2, help="Crop padding = face_max_dim * padding (default: 2.2)")
    parser.add_argument("--headroom", type=float, default=0.10, help="Shift crop up by face_max_dim * headroom (default: 0.10)")
    parser.add_argument("--no-face-detect", action="store_true", help="Skip face detection; use upper-third heuristic")
    parser.add_argument("--webp-quality", type=int, default=90, help="WEBP quality 0-100 (default: 90)")
    parser.add_argument("--no-webp", action="store_true", help="Skip writing the .webp variant")
    args = parser.parse_args()

    for label, p in [("template", args.template), ("photo", args.photo)]:
        if not p.expanduser().exists():
            print(f"error: {label} not found: {p}", file=sys.stderr)
            return 1

    template = Image.open(args.template.expanduser())
    photo = Image.open(args.photo.expanduser())

    face_bbox = None if args.no_face_detect else detect_face_bbox(args.photo.expanduser())
    if face_bbox:
        print(f"face bbox:    x={face_bbox[0]} y={face_bbox[1]} w={face_bbox[2]} h={face_bbox[3]}")
    else:
        print("face bbox:    none (using upper-third heuristic)")

    print(f"template:     {args.template}  size={template.size}")
    print(f"photo:        {args.photo}  size={photo.size}")
    print(f"border color: #{args.border[0]:02x}{args.border[1]:02x}{args.border[2]:02x}")

    out = replace_inner(template, photo, face_bbox, args.border, args.tolerance)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    out.save(args.output.with_suffix(".png"))
    print(f"wrote {args.output.with_suffix('.png')}")

    if not args.no_webp:
        webp_path = args.output.with_suffix(".webp")
        out.save(webp_path, "WEBP", quality=args.webp_quality, method=6)
        print(f"wrote {webp_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
