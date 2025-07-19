// @ts-check
import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import remarkPreserveNewlines from './src/utils/remark-preserve-newlines.js';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import rehypePrism from 'rehype-prism-plus';

// https://astro.build/config
export default defineConfig({
	site: 'https://ely0030.github.io',
	base: '/',
	integrations: [mdx({ syntaxHighlight: false }), sitemap()],
	output: 'static',
	markdown: {
		remarkPlugins: [remarkPreserveNewlines, remarkBreaks],
		syntaxHighlight: 'prism',
		rehypePlugins: [[rehypePrism, { ignoreMissing: true }]],
		smartypants: false,
	},
	vite: {
		build: {
			assetsInlineLimit: 0
		},
		ssr: {
			noExternal: ['js-sha256']
		},
		css: {
			// Ensure proper UTF-8 handling in CSS
			postcss: {
				plugins: []
			}
		},
		server: {
			proxy: {
				'/api': {
					target: 'http://127.0.0.1:4322',
					changeOrigin: true
				}
			}
		}
	},
});
