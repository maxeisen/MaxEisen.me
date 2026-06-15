// Shared Cloudinary gallery constants used by galleryList, checkGalleryPassword
// and signCloudinaryUpload.

export const CLOUD_NAME = "meisen-gallery";

// A gallery scope ("gallery", "ride", "run", …) is interpolated into the env
// var name `GALLERY_<SCOPE>_PASSWORD` and into Cloudinary tags/folders, so it
// must be a short plain-alnum slug. Anything else is rejected before we read
// any state or env var derived from caller input.
export const SCOPE_RE = /^[a-z0-9]{1,32}$/;
