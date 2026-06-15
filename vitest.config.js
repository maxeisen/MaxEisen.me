import { defineConfig } from 'vitest/config';

// Standalone Vitest config (kept separate from vite.config.js so the Svelte
// plugin isn't applied to the plain-JS logic/function tests). Tests are
// co-located next to the modules they cover as *.test.js.
export default defineConfig({
	test: {
		environment: 'node',
		include: [
			'src/**/*.test.js',
			'netlify/**/*.test.js',
			'tests/**/*.test.js',
		],
	},
});
