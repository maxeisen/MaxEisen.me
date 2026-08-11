// Load the hand-authored marathon plan.
//
// The plan is a static site asset (public/content/marathon-plan.json) rather
// than stored state — it's edited in the repo and deployed, so the functions
// use the same file the site ships.
//
// Imported as a module rather than read from disk. A `readFileSync` against a
// path derived from `import.meta.url` looks like it should work (it's how
// signedGalleryList loads its manifests) but silently returned an empty plan
// under `netlify dev`: the bundled function is emitted to a temp directory, so
// the relative path no longer points anywhere near the repo. Importing the
// JSON makes the bundler inline the contents, which removes runtime path
// resolution from the picture entirely and works identically in the bundle,
// under vitest, and in plain Node.

import planJson from "../../../../public/content/marathon-plan.json" with { type: "json" };

/**
 * @returns {{race: object, thresholds: object, weeks: object[]}}
 */
export function loadPlan() {
	return {
		race: planJson?.race || {},
		thresholds: planJson?.thresholds || {},
		weeks: Array.isArray(planJson?.weeks) ? planJson.weeks : [],
	};
}
