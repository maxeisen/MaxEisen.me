// Bulk-download helper.
//
// Platform behaviour:
//   - Desktop: trigger an anchor[download] click per photo. Cloudinary
//     serves with Content-Disposition: attachment so the browser saves
//     each with a sensible filename. The browser will prompt once for
//     "allow multiple downloads" on the second file in Chrome; after that
//     they all stream into Downloads. No zip — users prefer individual
//     originals on desktop.
//   - Mobile (touch + no-hover): native share sheet with the files array
//     so iOS/Android can save directly to Photos. Falls back to a zip if
//     navigator.canShare({files}) isn't supported (older mobile browsers).
//     JSZip is dynamic-imported so its ~28 KB only ships when actually
//     needed.

import { downloadUrl, downloadFilename } from "./cloudinary.js";

function isMobileDevice() {
	if (typeof navigator === "undefined") return false;
	// Chromium UA Client Hints — most reliable when available.
	if (navigator.userAgentData?.mobile != null) return navigator.userAgentData.mobile;
	// CSS-media fallback: touch primary + no hover ≈ phone or tablet.
	if (typeof window === "undefined") return false;
	return window.matchMedia("(pointer: coarse) and (hover: none)").matches;
}

async function downloadIndividually(photos, onProgress) {
	// Anchor-click each photo. Cloudinary's fl_attachment (in downloadUrl)
	// sets Content-Disposition so the browser treats it as a download with
	// the URL-derived filename. A small inter-download pause avoids merging
	// or rate-limiting under Chrome.
	for (let i = 0; i < photos.length; i++) {
		const p = photos[i];
		const a = document.createElement("a");
		a.href = downloadUrl(p);
		a.download = downloadFilename(p);
		a.rel = "noopener";
		document.body.appendChild(a);
		a.click();
		a.remove();
		onProgress?.(i + 1, photos.length);
		if (i < photos.length - 1) await new Promise((r) => setTimeout(r, 150));
	}
}

async function fetchAsFile(photo) {
	const res = await fetch(downloadUrl(photo));
	if (!res.ok) throw new Error(`Failed to fetch ${photo.public_id}: ${res.status}`);
	const blob = await res.blob();
	return new File([blob], downloadFilename(photo), { type: blob.type || "image/jpeg" });
}

async function shareOrZip(photos, onProgress, zipName) {
	// Fetch all files first — both share() and zip() need them in memory.
	const files = [];
	for (const p of photos) {
		files.push(await fetchAsFile(p));
		onProgress?.(files.length, photos.length);
	}

	if (navigator.canShare && navigator.canShare({ files })) {
		try {
			await navigator.share({ files });
			return;
		} catch (err) {
			if (err?.name === "AbortError") return; // user cancelled
			console.warn("share() failed, falling back to zip:", err);
		}
	}

	const { default: JSZip } = await import("jszip");
	const zip = new JSZip();
	for (const f of files) zip.file(f.name, f);
	const blob = await zip.generateAsync({ type: "blob" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${zipName}.zip`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Download an array of photos. Routes to per-file anchor downloads on
 * desktop and to the native share sheet on mobile (zip fallback if the
 * device doesn't expose Web Share with files).
 *
 * @param {Array} photos
 * @param {Object} opts
 * @param {string} [opts.zipName] - base name for the mobile-fallback zip
 * @param {(done: number, total: number) => void} [opts.onProgress]
 */
export async function downloadPhotos(photos, opts = {}) {
	if (!photos || photos.length === 0) return;
	const { zipName = "photos", onProgress } = opts;
	if (isMobileDevice()) {
		await shareOrZip(photos, onProgress, zipName);
	} else {
		await downloadIndividually(photos, onProgress);
	}
}
