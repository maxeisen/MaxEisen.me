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

/**
 * Build the standard lightbox URL for a photo (2400px wide, auto format).
 */
export function lightboxUrl(photo) {
    return cloudinaryUrl(photo.public_id, "f_auto,q_auto,w_2400");
}

/**
 * Build the masonry thumb URL for a photo (800px wide, auto format).
 */
export function thumbUrl(photo) {
    return cloudinaryUrl(photo.public_id, "f_auto,q_auto,w_800");
}

/**
 * Build a display-pixel-sized slideshow URL.
 */
export function slideshowUrl(photo) {
    return cloudinaryUrl(photo.public_id, `f_auto,q_auto,w_${displayPixelWidth()}`);
}

/**
 * Build a max-quality download URL for a photo. `q_auto:best` keeps the
 * file modest in size without surrendering visible quality; `fl_attachment`
 * adds a Content-Disposition header so direct anchor clicks get a sensible
 * filename (the download flow also overrides this client-side).
 */
export function downloadUrl(photo) {
    return cloudinaryUrl(photo.public_id, "f_jpg,q_auto:best,fl_attachment");
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
