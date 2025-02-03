import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			buffer: 'buffer/index.js',
		},
	},
	ssr: {
		// Prevent Vite from bundling nsfwjs on the server
		noExternal: ['nsfwjs']
	}
});
