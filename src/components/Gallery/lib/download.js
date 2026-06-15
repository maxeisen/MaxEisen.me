// Bulk-download helper.
//
// Platform behaviour:
//   - Desktop: zip every selected photo into a single archive and trigger
//     one download. Per-file anchor downloads get rate-limited by Chrome
//     after a few requests, so users would lose photos silently — a zip
//     guarantees all selected end up in Downloads.
//   - Mobile (touch + no-hover): native share sheet with the files array.
//     iOS / Android offer "Save Images" / "Save to Files" / AirDrop and
//     the photos land individually in Photos. If the platform doesn't
//     support sharing files (older mobile browsers), fall back to zip so
//     the user still gets every selected photo.
//
// JSZip is dynamic-imported so its ~28 KB only ships when a user actually
// invokes a download.

import { downloadUrl, downloadFilename } from "./cloudinary.js";
import { mapWithConcurrency } from "../../../lib/data/concurrent.js";

// Cap simultaneous downloads so a large selection doesn't open dozens of
// sockets at once (and so Cloudinary isn't hit with a thundering herd).
const DOWNLOAD_CONCURRENCY = 4;

/**
 * Download a single photo. Always delivers the file directly (no zip) by
 * relying on Cloudinary's fl_attachment Content-Disposition header — the
 * browser handles it as an attachment regardless of platform.
 *
 * iOS Safari opens a save sheet for cross-origin attachments; desktop
 * browsers drop the file into Downloads.
 */
export function downloadOne(photo) {
	if (!photo) return;
	const a = document.createElement("a");
	a.href = downloadUrl(photo);
	a.download = downloadFilename(photo);
	a.rel = "noopener";
	document.body.appendChild(a);
	a.click();
	a.remove();
}

function isMobileDevice() {
	if (typeof navigator === "undefined") return false;
	// Chromium UA Client Hints — most reliable when available.
	if (navigator.userAgentData?.mobile != null) return navigator.userAgentData.mobile;
	// CSS-media fallback: touch primary + no hover ≈ phone or tablet.
	if (typeof window === "undefined") return false;
	return window.matchMedia("(pointer: coarse) and (hover: none)").matches;
}

async function fetchAsFile(photo) {
	const res = await fetch(downloadUrl(photo));
	if (!res.ok) throw new Error(`Failed to fetch ${photo.public_id}: ${res.status}`);
	const blob = await res.blob();
	return new File([blob], downloadFilename(photo), { type: blob.type || "image/jpeg" });
}

async function fetchAll(photos, onProgress) {
	return mapWithConcurrency(photos, DOWNLOAD_CONCURRENCY, fetchAsFile, onProgress);
}

async function zipDownload(files, zipName) {
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
 * Download an array of photos. Zips on desktop, shares on mobile (with a
 * zip fallback only if the mobile platform doesn't support Web Share with
 * files). Either way every selected photo is delivered to the user.
 *
 * @param {Array} photos
 * @param {Object} opts
 * @param {string} [opts.zipName] - base name for the zip archive
 * @param {(done: number, total: number) => void} [opts.onProgress]
 */
export async function downloadPhotos(photos, opts = {}) {
	if (!photos || photos.length === 0) return;
	const { zipName = "photos", onProgress } = opts;

	const files = await fetchAll(photos, onProgress);

	if (isMobileDevice() && navigator.canShare && navigator.canShare({ files })) {
		try {
			await navigator.share({ files });
			return;
		} catch (err) {
			if (err?.name === "AbortError") return; // user cancelled deliberately
			console.warn("share() failed, falling back to zip:", err);
		}
	}

	await zipDownload(files, zipName);
}
