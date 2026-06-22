#!/usr/bin/env python3
"""
Build a numbered labeling sheet from clusters.json so a human can put first
names to the top-N people. One representative face per person, with its
cluster rank stamped on it. Open the sheet, then hand back "rank: Name" lines.

Usage (venv from cluster-faces.py setup):
  ~/.venvs/faces/bin/python scripts/face-label-sheet.py --min-photos 30

Outputs <out>/labeling-sheet_##.jpg (paginated) + names-template.txt.
"""

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

HOME = Path.home()
DEFAULT_SRC = [
    HOME / "Downloads/laramaxswedding-photo-download-1of2",
    HOME / "Downloads/laramaxswedding-photo-download-2of2",
    HOME / "Downloads/to-upload",
]
DEFAULT_DIR = HOME / "Downloads/wedding-face-clusters"
IMG_EXT = {".jpg", ".jpeg", ".png", ".heic", ".webp"}


def index_files(src_dirs):
    idx = {}
    for d in src_dirs:
        d = Path(d)
        if not d.exists():
            continue
        for p in d.rglob("*"):
            if p.suffix.lower() in IMG_EXT and p.stem not in idx:
                idx[p.stem] = p
    return idx


def face_crop(img, frac, margin=0.45, size=220):
    h, w = img.shape[:2]
    fx, fy, fw, fh = frac
    x1, y1 = fx * w, fy * h
    bw, bh = fw * w, fh * h
    cx, cy = x1 + bw / 2, y1 + bh / 2
    half = max(bw, bh) * (1 + margin) / 2
    a, b = int(max(0, cx - half)), int(max(0, cy - half))
    c, d = int(min(w, cx + half)), int(min(h, cy + half))
    crop = img[b:d, a:c]
    if crop.size == 0:
        return np.full((size, size, 3), 60, np.uint8)
    return cv2.resize(crop, (size, size), interpolation=cv2.INTER_AREA)


def stamp(cell, rank, nphotos):
    """Draw '#rank' + photo count on a face cell."""
    cv2.rectangle(cell, (0, 0), (cell.shape[1], 34), (0, 0, 0), -1)
    cv2.putText(cell, f"#{rank}", (6, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(cell, f"{nphotos}p", (cell.shape[1] - 52, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 220, 255), 1, cv2.LINE_AA)
    return cell


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clusters", default=str(DEFAULT_DIR / "clusters.json"))
    ap.add_argument("--src", nargs="*", default=[str(p) for p in DEFAULT_SRC])
    ap.add_argument("--out", default=str(DEFAULT_DIR))
    ap.add_argument("--min-photos", type=int, default=30, help="include people in at least this many photos")
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--cell", type=int, default=220)
    ap.add_argument("--per-sheet", type=int, default=48)
    args = ap.parse_args()

    data = json.loads(Path(args.clusters).read_text())
    people = [c for c in data["clusters"] if c["num_photos"] >= args.min_photos]
    print(f"{len(people)} people with >= {args.min_photos} photos")

    files = index_files(args.src)
    out = Path(args.out)
    pad, cols, cell = 6, args.cols, args.cell

    template = []
    sheets = 0
    for start in range(0, len(people), args.per_sheet):
        chunk = people[start:start + args.per_sheet]
        rows = (len(chunk) + cols - 1) // cols
        W = cols * cell + (cols + 1) * pad
        H = rows * cell + (rows + 1) * pad
        sheet = np.full((H, W, 3), 30, np.uint8)
        for i, person in enumerate(chunk):
            rep = person["representative"]
            path = files.get(rep["stem"])
            img = cv2.imread(str(path)) if path else None
            crop = face_crop(img, rep["bbox_frac"]) if img is not None else np.full((cell, cell, 3), 60, np.uint8)
            crop = cv2.resize(crop, (cell, cell))
            stamp(crop, person["rank"], person["num_photos"])
            r, c = divmod(i, cols)
            y, x = pad + r * (cell + pad), pad + c * (cell + pad)
            sheet[y:y + cell, x:x + cell] = crop
            template.append(f'{person["rank"]}: ')
        name = f"labeling-sheet_{sheets:02d}.jpg"
        cv2.imwrite(str(out / name), sheet)
        print(f"  wrote {name} ({len(chunk)} faces)")
        sheets += 1

    (out / "names-template.txt").write_text("\n".join(template) + "\n")
    print(f"\nOpen labeling-sheet_*.jpg, then fill in names-template.txt (or just send me 'rank: Name' lines).")


if __name__ == "__main__":
    main()
