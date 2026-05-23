// Bulk-download helper.
//
// On mobile (or anywhere navigator.canShare({files}) is true) we use the
// Web Share API so users get the native "Save Images" / "Save to Files" /
// AirDrop sheet — that's what they expect on iOS/Android and lands the
// photos in the Photos app cleanly.
//
// Everywhere else we zip the files client-side and trigger a single
// download. JSZip is dynamic-imported so the ~28 KB lib only ships when a
// user actually invokes a download.

import { downloadUrl, downloadFilename } from "./cloudinary.js";

/**
 * Fetch a single photo and wrap it in a File object.
 * Throws on network failure or non-2xx response.
 */
async function photoToFile(photo) {
	const res = await fetch(downloadUrl(photo));
	if (!res.ok) throw new Error(`Failed to fetch ${photo.public_id}: ${res.status}`);
	const blob = await res.blob();
	return new File([blob], downloadFilename(photo), { type: blob.type || "image/jpeg" });
}

/**
 * Download an array of photos. Reports progress via the optional callback
 * (number of files fetched / total). Returns once the user has either
 * accepted the share sheet, dismissed it, or the zip download has been
 * triggered. Rethrows fetch errors so the caller can show a message.
 *
 * @param {Array} photos
 * @param {Object} opts
 * @param {string} [opts.zipName] - base name for the fallback zip (no extension)
 * @param {(done: number, total: number) => void} [opts.onProgress]
 */
export async function downloadPhotos(photos, opts = {}) {
	if (!photos || photos.length === 0) return;
	const { zipName = "photos", onProgress } = opts;

	const files = [];
	let done = 0;
	// Sequential fetch keeps the Cloudinary upstream from getting hammered
	// when someone selects 50+ photos; the bottleneck is bandwidth anyway.
	for (const p of photos) {
		files.push(await photoToFile(p));
		done++;
		onProgress?.(done, photos.length);
	}

	// Mobile path: native share sheet with the files array.
	// canShare must be called with the same object we plan to pass to share().
	if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files })) {
		try {
			await navigator.share({ files });
			return;
		} catch (err) {
			// AbortError = user cancelled. NotAllowedError = user gesture stale.
			// Either way, fall through to zip so they still get the photos.
			if (err?.name !== "AbortError") {
				console.warn("share() failed, falling back to zip:", err);
			} else {
				return; // user cancelled deliberately — don't surprise them with a zip
			}
		}
	}

	// Desktop / fallback path: zip + anchor download.
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
	// Revoke after a tick so the browser has handed the blob to the download.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
