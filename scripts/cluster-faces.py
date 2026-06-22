#!/usr/bin/env python3
"""
Proof-of-concept face clustering for the wedding gallery.

Runs ENTIRELY LOCALLY on the original photos — no uploads, no cloud, no
Cloudinary credits touched. It detects every face, computes an embedding,
clusters the embeddings into "people", and writes:

  - <out>/cluster_###_n<faces>_p<photos>.jpg  : a contact sheet per person so
        you can eyeball how clean the grouping is
  - <out>/clusters.json                        : machine-readable mapping
        (person -> the photo filenames they appear in + a representative face),
        which is what a future gallery filter would consume.

This is a QUALITY PROBE. Look at the contact sheets: a good cluster is one
person across many shots; a bad one mixes people or splits one person across
several clusters. Tune --eps (smaller = stricter/more clusters) and
--min-samples if needed, then re-run.

------------------------------------------------------------------------------
Setup (one time):

  python3 -m venv ~/.venvs/faces
  source ~/.venvs/faces/bin/activate
  pip install insightface onnxruntime opencv-python-headless numpy scikit-learn

Quick trial on a subset first (fast sanity check):

  python3 scripts/cluster-faces.py --limit 150

Full run (all ~1448 photos; a few to ~20 min on CPU):

  python3 scripts/cluster-faces.py

The model pack (~300MB, "buffalo_l") downloads once on first run.
------------------------------------------------------------------------------
"""

import argparse
import json
import os
import sys
from pathlib import Path

import cv2
import numpy as np

HOME = Path.home()
# The wedding originals are spread across these local folders after the upload
# staging we did; dedupe by filename so an overlap is processed once.
DEFAULT_SRC = [
    HOME / "Downloads/laramaxswedding-photo-download-1of2",
    HOME / "Downloads/laramaxswedding-photo-download-2of2",
    HOME / "Downloads/to-upload",
]
DEFAULT_OUT = HOME / "Downloads/wedding-face-clusters"
IMG_EXT = {".jpg", ".jpeg", ".png", ".heic", ".webp"}


def find_images(src_dirs, limit=None):
    """Collect image paths across the source dirs, deduped by basename."""
    seen, paths = set(), []
    for d in src_dirs:
        d = Path(d)
        if not d.exists():
            print(f"  (skip, not found) {d}")
            continue
        for p in sorted(d.rglob("*")):
            if p.suffix.lower() in IMG_EXT and p.name not in seen:
                seen.add(p.name)
                paths.append(p)
    if limit:
        paths = paths[:limit]
    return paths


def downscale(img, max_dim):
    h, w = img.shape[:2]
    s = max_dim / max(h, w)
    if s < 1.0:
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    return img


def square_crop(img, bbox, margin=0.35, size=160):
    """Crop a padded square around a face bbox and resize to `size`."""
    h, w = img.shape[:2]
    x1, y1, x2, y2 = bbox
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    half = max(x2 - x1, y2 - y1) * (1 + margin) / 2
    a = int(max(0, cx - half)); b = int(max(0, cy - half))
    c = int(min(w, cx + half)); d = int(min(h, cy + half))
    crop = img[b:d, a:c]
    if crop.size == 0:
        return None
    return cv2.resize(crop, (size, size), interpolation=cv2.INTER_AREA)


def blur_var(crop):
    """Laplacian variance — low = blurry. Cheap sharpness proxy."""
    g = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(g, cv2.CV_64F).var()


def nose_offset(kps):
    """How far the nose sits from the eye-midpoint, in eye-distance units.
    ~0 frontal, large = profile (eyes foreshorten so the ratio blows up).
    Returns 0 (treated as frontal) if keypoints are unavailable."""
    if kps is None or len(kps) < 3:
        return 0.0
    le, re, nose = kps[0], kps[1], kps[2]
    eye_mid_x = (le[0] + re[0]) / 2.0
    eye_dist = float(np.hypot(re[0] - le[0], re[1] - le[1]))
    return abs(nose[0] - eye_mid_x) / (eye_dist + 1e-6)


def montage(crops, cols=6, cell=160, pad=4, bg=30):
    """Tile face crops into a single contact-sheet image."""
    n = len(crops)
    rows = (n + cols - 1) // cols
    W = cols * cell + (cols + 1) * pad
    H = rows * cell + (rows + 1) * pad
    sheet = np.full((H, W, 3), bg, np.uint8)
    for i, cr in enumerate(crops):
        r, c = divmod(i, cols)
        y = pad + r * (cell + pad)
        x = pad + c * (cell + pad)
        sheet[y:y + cell, x:x + cell] = cr
    return sheet


def main():
    ap = argparse.ArgumentParser(description="Local face clustering POC")
    ap.add_argument("--src", nargs="*", default=[str(p) for p in DEFAULT_SRC], help="source image dirs")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="output dir for contact sheets + json")
    ap.add_argument("--limit", type=int, default=0, help="process only the first N photos (trial run)")
    ap.add_argument("--max-dim", type=int, default=1600, help="downscale long edge to this before detect (speed)")
    ap.add_argument("--eps", type=float, default=0.45, help="DBSCAN cosine-distance radius (smaller = stricter)")
    ap.add_argument("--min-samples", type=int, default=3, help="min faces to form a person cluster")
    ap.add_argument("--min-det-score", type=float, default=0.65, help="drop low-confidence detections")
    ap.add_argument("--min-face-px", type=int, default=70, help="drop faces smaller than this (long edge)")
    ap.add_argument("--min-blur", type=float, default=40.0, help="clustering: drop blurry faces (Laplacian variance below this)")
    ap.add_argument("--max-nose-offset", type=float, default=0.6, help="clustering: drop non-frontal faces (nose offset / eye-dist above this)")
    # Second pass: after clean clusters define each person, assign the rest of
    # the (profile/blurry/smaller) faces to a known person when confident.
    ap.add_argument("--assign-sim", type=float, default=0.42, help="2nd pass: min cosine sim to a person's centroid to assign")
    ap.add_argument("--assign-margin", type=float, default=0.04, help="2nd pass: best centroid must beat 2nd-best by this margin")
    ap.add_argument("--min-assign-det", type=float, default=0.4, help="2nd pass: minimal detection score to be eligible at all")
    ap.add_argument("--min-assign-px", type=int, default=40, help="2nd pass: minimal face size (long edge) to be eligible at all")
    ap.add_argument("--max-sheet", type=int, default=48, help="max faces shown per contact sheet")
    args = ap.parse_args()

    # Imported here so --help works without the heavy dep installed.
    try:
        from insightface.app import FaceAnalysis
        from sklearn.cluster import DBSCAN
    except ImportError as e:
        sys.exit(f"Missing dependency: {e}\nSee the setup block at the top of this script.")

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    images = find_images(args.src, args.limit or None)
    if not images:
        sys.exit("No images found. Pass --src <dir> with your wedding photos.")
    print(f"Found {len(images)} photos. Loading model (first run downloads ~300MB)…")

    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(640, 640))

    embeddings = []          # (512,) normalized vectors — ALL eligible faces
    faces = []               # parallel metadata; each carries a "clean" flag
    n_faces = 0
    drop = {"det": 0, "size": 0}   # below even the minimal assignment bar
    for i, path in enumerate(images, 1):
        img = cv2.imread(str(path))
        if img is None:
            print(f"  [{i}/{len(images)}] unreadable, skipped: {path.name}")
            continue
        img = downscale(img, args.max_dim)
        for f in app.get(img):
            size = max(f.bbox[2] - f.bbox[0], f.bbox[3] - f.bbox[1])
            # Minimal bar: drop only true garbage. Profile/blurry/smaller faces
            # stay eligible so the 2nd pass can match them to a known person.
            if f.det_score < args.min_assign_det:
                drop["det"] += 1; continue
            if size < args.min_assign_px:
                drop["size"] += 1; continue
            crop = square_crop(img, f.bbox)
            if crop is None:
                continue
            # "clean" faces (sharp, frontal, large, confident) FORM the clusters
            # / person identities; the rest are assignment-only in pass two.
            clean = (
                f.det_score >= args.min_det_score
                and size >= args.min_face_px
                and nose_offset(f.kps) <= args.max_nose_offset
                and blur_var(crop) >= args.min_blur
            )
            ih, iw = img.shape[:2]
            embeddings.append(f.normed_embedding.astype(np.float32))
            faces.append({
                "stem": path.stem,            # = Cloudinary display_name (join key)
                "det": float(f.det_score),
                "bbox": [float(v) for v in f.bbox],
                "dims": [iw, ih],
                "crop": crop,
                "clean": clean,
            })
            n_faces += 1
        if i % 50 == 0 or i == len(images):
            print(f"  [{i}/{len(images)}] photos scanned, {n_faces} faces so far")

    n_clean = sum(1 for f in faces if f["clean"])
    print(f"  {n_faces} eligible faces ({n_clean} clean for clustering) | dropped garbage — low-conf:{drop['det']} tiny:{drop['size']}")
    if not embeddings:
        sys.exit("No faces detected.")

    X = np.vstack(embeddings)                       # (N, 512), unit vectors
    clean_idx = np.array([i for i, f in enumerate(faces) if f["clean"]])

    # Pass 1: cluster the clean faces into person identities.
    print(f"\nPass 1: clustering {len(clean_idx)} clean faces (eps={args.eps}, min_samples={args.min_samples})…")
    clean_labels = DBSCAN(eps=args.eps, min_samples=args.min_samples, metric="cosine", n_jobs=-1).fit_predict(X[clean_idx])

    # Centroid per person = renormalized mean of its clean faces.
    labels_sorted = sorted({int(l) for l in clean_labels if l >= 0})
    centroids = []
    for lab in labels_sorted:
        rows = clean_idx[clean_labels == lab]
        c = X[rows].mean(axis=0)
        centroids.append(c / (np.linalg.norm(c) + 1e-9))
    C = np.vstack(centroids) if centroids else np.zeros((0, X.shape[1]), np.float32)

    # Pass 2: assign EVERY eligible face to the closest person, if the match is
    # confident (sim) AND unambiguous (beats 2nd-best by a margin).
    print(f"Pass 2: assigning all {n_faces} faces to {len(labels_sorted)} identities "
          f"(sim>={args.assign_sim}, margin>={args.assign_margin})…")
    assign = np.full(n_faces, -1, dtype=int)
    if C.shape[0]:
        sims = X @ C.T                              # (N, L)
        order = np.argsort(-sims, axis=1)
        rows = np.arange(n_faces)
        best = sims[rows, order[:, 0]]
        second = sims[rows, order[:, 1]] if C.shape[0] > 1 else np.zeros(n_faces)
        ok = (best >= args.assign_sim) & ((best - second) >= args.assign_margin)
        assign[ok] = np.array(labels_sorted)[order[ok, 0]]

    # Pass-1 clean membership → STABLE ranking + representative (identical clean
    # faces + params + deterministic DBSCAN ⇒ same ranks as the labeled run, so
    # names-template.txt stays valid). Pass-2 assignment → final photo coverage.
    clean_members = {lab: [] for lab in labels_sorted}
    for j, lab in zip(clean_idx.tolist(), clean_labels.tolist()):
        if lab >= 0:
            clean_members[lab].append(j)
    assigned = {lab: [] for lab in labels_sorted}
    for i, lab in enumerate(assign):
        if lab >= 0:
            assigned[int(lab)].append(i)
    noise = int((assign < 0).sum())
    recovered = sum(1 for i, lab in enumerate(assign) if lab >= 0 and not faces[i]["clean"])

    def clean_photo_count(lab):
        return len({faces[i]["stem"] for i in clean_members[lab]})

    ordered_labels = sorted(labels_sorted, key=clean_photo_count, reverse=True)

    manifest = {
        "params": vars(args),
        "total_photos": len(images),
        "total_faces": n_faces,
        "noise_faces": noise,
        "num_people": len(ordered_labels),
        "clusters": [],
    }

    print(f"\n→ {len(ordered_labels)} people | recovered {recovered} extra faces via pass 2 | {noise} unmatched\n")
    print(f"{'person':>7}  {'faces':>5}  {'photos':>6}")
    for rank, lab in enumerate(ordered_labels):
        idxs = sorted(assigned[lab], key=lambda i: faces[i]["det"], reverse=True)
        photos = sorted({faces[i]["stem"] for i in idxs})
        # Representative = best CLEAN face (sharp/frontal) for a good chip.
        rep = faces[max(clean_members[lab], key=lambda i: faces[i]["det"])]
        rx1, ry1, rx2, ry2 = rep["bbox"]
        rw, rh = rep["dims"]
        bbox_frac = [
            round(rx1 / rw, 5), round(ry1 / rh, 5),
            round((rx2 - rx1) / rw, 5), round((ry2 - ry1) / rh, 5),
        ]
        sheet = montage([faces[i]["crop"] for i in idxs[:args.max_sheet]])
        name = f"cluster_{rank:03d}_n{len(idxs)}_p{len(photos)}.jpg"
        cv2.imwrite(str(out / name), sheet)
        manifest["clusters"].append({
            "rank": rank,
            "num_faces": len(idxs),
            "num_photos": len(photos),
            "representative": {"stem": rep["stem"], "bbox_frac": bbox_frac},
            "photos": photos,
            "sheet": name,
        })
        if rank < 25:
            print(f"{rank:>7}  {len(idxs):>5}  {len(photos):>6}")
    if len(ordered_labels) > 25:
        print(f"   …and {len(ordered_labels) - 25} smaller clusters")

    (out / "clusters.json").write_text(json.dumps(manifest, indent=2))
    print(f"\nWrote contact sheets + clusters.json to:\n  {out}")
    print("Contact sheets now include 2nd-pass faces — scan each for an intruder (a different person).")
    print("Too many intruders → raise --assign-sim/--assign-margin. Still missing faces → lower them.")


if __name__ == "__main__":
    main()
