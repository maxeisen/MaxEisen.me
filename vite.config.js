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
		open: true
	},
	preview: {
		port: 6808,
		open: true
	},
	build: {
		outDir: 'dist',
		rollupOptions: {
			output: {
				entryFileNames: 'build/bundle.js',
				chunkFileNames: 'build/[name]-[hash].js',
				assetFileNames: 'build/[name][extname]'
			}
		}
	},
	publicDir: 'public'
});
