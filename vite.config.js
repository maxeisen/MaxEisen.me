import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [svelte()],
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
