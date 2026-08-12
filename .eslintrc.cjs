/**
 * Lint rules describing how this repo is actually written, rather than a
 * generic preset it doesn't follow.
 *
 * It exists mostly so the rules are visible while writing rather than after
 * pushing: the static analysis on pull requests runs its own default ESLint
 * config, which disagrees with the house style in ways that produce noise
 * (braces around one-line guards, a complexity ceiling of 4, snake_case from
 * Strava and Cloudinary payloads read as naming errors). Where a rule here
 * differs from that default, the comment says why.
 *
 * Pinned to ESLint 8 / eslintrc rather than flat config to match the analyser.
 */
module.exports = {
	root: true,
	env: { browser: true, es2023: true },
	parserOptions: { ecmaVersion: 2023, sourceType: "module" },
	extends: ["eslint:recommended"],
	globals: {
		// Svelte runes are compiler intrinsics, not imports.
		$state: "readonly",
		$derived: "readonly",
		$effect: "readonly",
		$props: "readonly",
		$bindable: "readonly",
		$inspect: "readonly",
		$host: "readonly",
		// Injected by the Netlify Functions runtime (see _shared/env.js).
		Netlify: "readonly",
	},
	rules: {
		// The house style is a one-line guard — `if (!dayKey) return "";` —
		// which reads better than three lines of the same thing. Braces are
		// still required the moment the body moves onto its own line.
		curly: ["error", "multi-line"],
		eqeqeq: ["error", "smart"],
		// Payload fields arrive snake_case from Strava and Cloudinary; renaming
		// them at the boundary would obscure what the API actually returned.
		camelcase: ["error", { properties: "never", ignoreDestructuring: true }],
		// console.log IS the output in scripts/ (overridden below); everywhere
		// else it's a leftover, while warn/error are deliberate.
		"no-console": ["error", { allow: ["warn", "error"] }],
		"no-unused-vars": [
			"error",
			// Rest siblings are how fields get dropped from a payload:
			// `const { display_name, ...rest } = photo`.
			{ args: "after-used", caughtErrors: "none", ignoreRestSiblings: true },
		],
		"no-use-before-define": ["error", { functions: false, classes: false }],
		// Storage and parse failures are routinely "the same as absent", and an
		// empty catch says that more clearly than a comment would.
		"no-empty": ["error", { allowEmptyCatch: true }],
		// A file may also declare a rune for another analyser's benefit; that
		// isn't a redeclaration of the globals above.
		"no-redeclare": ["error", { builtinGlobals: false }],
		// Tabs indent, spaces align: continuation lines inside block comments
		// line up under the text above them regardless of tab width.
		"no-mixed-spaces-and-tabs": ["error", "smart-tabs"],
		// A warning, not a gate: a handful of older functions are over this and
		// splitting them up is its own piece of work.
		complexity: ["warn", 12],
		"prefer-const": "error",
		"no-var": "error",
	},
	overrides: [
		{
			files: ["**/*.svelte"],
			parser: "svelte-eslint-parser",
			plugins: ["svelte"],
			extends: ["plugin:svelte/recommended"],
			rules: {
				// `let { title } = $props()` is required syntax, not a missed const.
				"prefer-const": "off",
				// Compiler warnings — a11y, unused CSS. `vite build` already
				// prints these, so surface them without gating on them.
				"svelte/valid-compile": "warn",
				// The site renders its own markdown through marked.
				"svelte/no-at-html-tags": "off",
				// Runes are conventionally declared below the handlers that read
				// them, which is safe: handlers only run after init.
				"no-use-before-define": [
					"error",
					{ functions: false, classes: false, variables: false },
				],
			},
		},
		{
			files: [
				"netlify/**/*.js",
				"scripts/**/*.{js,mjs}",
				"e2e/**/*.js",
				"*.config.js",
			],
			env: { node: true, browser: true },
		},
		{
			files: ["scripts/**/*.{js,mjs}"],
			rules: { "no-console": "off" },
		},
		{
			files: ["**/*.test.js", "e2e/**/*.e2e.js"],
			env: { node: true },
		},
	],
	ignorePatterns: [
		"dist/",
		"node_modules/",
		"public/build/",
		"public/styles/",
		"private/",
		"test-results/",
		// Imports the plan with an import attribute (`with { type: "json" }`),
		// which ESLint 8's parser can't read. Vitest and Node both can.
		"netlify/functions/_shared/training/planFile.js",
	],
};
