#!/usr/bin/env python3
# Helper for scripts/set-chip.mjs: locate a specific person's face in a photo.
# Args: <reference_image_url> <target_image_url>
#   reference = a crop that is definitely the person (their current chip area)
#   target    = the full photo to find them in
# Prints "BOX x_y_w_h sim=<n>" (fractional bbox of the matching face) or
# "NOMATCH:<reason>". Used by set-chip to crop the right face in a group shot.

import sys, urllib.request, cv2, numpy as np
from insightface.app import FaceAnalysis

ref_url, tgt_url = sys.argv[1], sys.argv[2]
app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
app.prepare(ctx_id=0, det_size=(640, 640))

def fetch(u):
    return cv2.imdecode(np.frombuffer(urllib.request.urlopen(u, timeout=25).read(), np.uint8), cv2.IMREAD_COLOR)

ref = fetch(ref_url)
rf = app.get(ref) if ref is not None else None
if not rf:
    print("NOMATCH:no face in reference"); sys.exit(0)
R = max(rf, key=lambda f: f.bbox[2] - f.bbox[0]).normed_embedding

tgt = fetch(tgt_url)
fs = app.get(tgt) if tgt is not None else None
if not fs:
    print("NOMATCH:no faces in target"); sys.exit(0)

best = max(fs, key=lambda f: float(np.dot(f.normed_embedding, R)))
sim = float(np.dot(best.normed_embedding, R))
if sim < 0.42:
    print(f"NOMATCH:best match only {sim:.2f}"); sys.exit(0)

h, w = tgt.shape[:2]
x1, y1, x2, y2 = best.bbox
print(f"BOX {x1/w:.5f}_{y1/h:.5f}_{(x2-x1)/w:.5f}_{(y2-y1)/h:.5f} sim={sim:.2f}")
