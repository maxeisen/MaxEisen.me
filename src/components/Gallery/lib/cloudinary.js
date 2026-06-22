// Shared Cloudinary helpers used across the Gallery components.
//
// Putting these in one place means the Gallery component itself stays small
// and the same URL shapes get reused by Lightbox, Slideshow, MasonryGrid,
// and UploadZone without duplication.

export const CLOUDINARY_CLOUD = "meisen-gallery";

/**
 * Build a Cloudinary image URL with the given transforms.
 *
 * The file extension is deliberately omitted from the public_id so that
 * `f_auto` can negotiate WebP / AVIF / JPEG based on the browser's
 * `Accept` headers at request time.
 *
 * @param {string} publicId - Cloudinary public_id
 * @param {string} transforms - comma-separated transforms e.g. "f_auto,q_auto,w_2400"
 */
export function cloudinaryUrl(publicId, transforms) {
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/${transforms}/${publicId}`;
}

/**
 * Choose a slideshow image width tied to the visitor's physical display.
 *
 * Multiplies the longest CSS-pixel dimension by devicePixelRatio (capped at
 * 3 so we don't size for HiDPI absurdity), rounds up to the nearest 400px
 * so Cloudinary caches against a small set of derivatives, and caps at
 * 5200px so a 5K monitor still hits a known-friendly size.
 *
 * Falls back to 2400 in non-browser contexts.
 */
export function displayPixelWidth() {
    if (typeof window === "undefined" || typeof screen === "undefined") return 2400;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const longestCss = Math.max(
        screen.width || 0, screen.height || 0,
        window.innerWidth, window.innerHeight,
    );
    return Math.min(Math.ceil((longestCss * dpr) / 400) * 400, 5200);
}

// Private (authenticated-delivery) galleries can't build URLs client-side —
// the browser has no API secret to sign them. For those, signedGalleryList
// returns each photo already carrying pre-signed `thumb` / `full` / `download`
// URLs, and these helpers return them verbatim. Public galleries send only a
// `public_id`, so the helpers fall through to building a normal `image/upload`
// URL. This keeps MasonryGrid / Lightbox / Slideshow / download.js identical
// for both gallery types — the photo object decides which path is used.

/**
 * Lightbox URL (2400px wide). Prefers a pre-signed `full` URL.
 */
export function lightboxUrl(photo) {
    return photo.full || cloudinaryUrl(photo.public_id, "f_auto,q_auto,w_2400");
}

/**
 * Masonry thumb URL (800px wide). Prefers a pre-signed `thumb` URL.
 */
export function thumbUrl(photo) {
    return photo.thumb || cloudinaryUrl(photo.public_id, "f_auto,q_auto,w_800");
}

/**
 * Slideshow URL. Public galleries size to the display; signed galleries
 * reuse the pre-signed `full` (2400px) — plenty for a slideshow and avoids
 * signing a per-device width server-side.
 */
export function slideshowUrl(photo) {
    return photo.full || cloudinaryUrl(photo.public_id, `f_auto,q_auto,w_${displayPixelWidth()}`);
}

/**
 * Max-quality download URL (`fl_attachment` for a sensible filename).
 * Prefers a pre-signed `download` URL.
 */
export function downloadUrl(photo) {
    return photo.download || cloudinaryUrl(photo.public_id, "f_jpg,q_auto:best,fl_attachment");
}

/**
 * Filename to use when saving a photo. We strip the Cloudinary path prefix
 * (everything before the last `/`) and append `.jpg` so the user gets a
 * readable name in their Downloads / Photos app.
 */
export function downloadFilename(photo) {
    const id = String(photo.public_id || "photo");
    const last = id.split("/").pop() || "photo";
    return `${last}.jpg`;
}
