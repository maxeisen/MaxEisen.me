// Netlify esbuild-bundles each function. Vitest's transform will load a
// file with duplicate imports; esbuild will not. This is the check that
// matches the deploy.

import { describe, it, expect } from "vitest";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const functions = [
	"trainingData.js",
	"trainingActivity.js",
	"trainingPage.js",
	"trainingSync.js",
	"stravaFeed.js",
	"stravaProfile.js",
];

describe("function bundles", () => {
	for (const name of functions) {
		it(`esbuild can bundle ${name}`, async () => {
			const entry = fileURLToPath(new URL(`../${name}`, import.meta.url));
			const result = await build({
				entryPoints: [entry],
				bundle: true,
				platform: "node",
				format: "esm",
				packages: "external",
				write: false,
				logLevel: "silent",
			});
			expect(result.errors).toEqual([]);
		});
	}
});
