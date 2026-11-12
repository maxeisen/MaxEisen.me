import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import blogPosts from './src/components/Blog/lib/postsPlugin.js';

const root = path.dirname(fileURLToPath(import.meta.url));

// Standalone Vitest config (kept separate from vite.config.js so the Svelte
// plugin isn't applied to the plain-JS logic/function tests). Tests are
// co-located next to the modules they cover as *.test.js.
export default defineConfig({
	// So tests can import blog posts the way the app does.
	plugins: [blogPosts()],
	// Same shortcut as vite.config.js, for logic that reads public/content.
	resolve: { alias: { '@content': path.join(root, 'public/content') } },
	test: {
		environment: 'node',
		include: [
			'src/**/*.test.js',
			'netlify/**/*.test.js',
			'tests/**/*.test.js',
		],
	},
});
