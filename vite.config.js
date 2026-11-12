import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { fileURLToPath } from 'url';
import resumeShell from './src/components/Resume/lib/shellPlugin.js';
import blogPosts from './src/components/Blog/lib/postsPlugin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	// resumeShell: /resume's document, with a plain résumé for no-JS visitors.
	// blogPosts: a post's .md as ?meta (front matter) or ?body (the text).
	plugins: [svelte(), resumeShell(), blogPosts()],
	resolve: {
		alias: {
			'@content': path.resolve(__dirname, 'public/content')
		}
	},
	server: {
		port: 6808,
		open: false,
		allowedHosts: [
			'maxeisen.me'
		]
	},
	preview: {
		port: 6808,
		open: true
	},
	build: {
		outDir: 'dist',
		rollupOptions: {
			output: {
				// Content-hash EVERY build artifact (entry + chunks + css/assets).
				// Hashed filenames change whenever content changes, so these can
				// be cached immutably (see the /build/* header in netlify.toml) —
				// Cloudflare + browsers keep them ~forever and the Netlify origin
				// stops getting revalidation hits, which is what was tripping
				// Netlify's per-origin rate limit (429s) after a cache purge.
				entryFileNames: 'build/[name]-[hash].js',
				chunkFileNames: 'build/[name]-[hash].js',
				assetFileNames: 'build/[name]-[hash][extname]'
			}
		}
	},
	publicDir: 'public'
});
