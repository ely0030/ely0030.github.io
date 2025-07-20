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
		shikiConfig: {
			// Choose from Shiki's built-in themes (or add your own)
			// https://github.com/shikijs/shiki/blob/main/docs/themes.md
			theme: 'one-dark-pro',
			// Add custom syntax highlighting rules as well.
			// https://github.com/shikijs/shiki/blob/main/docs/languages.md
			langs: [],
			// Enable word wrap to prevent horizontal scrolling
			wrap: true
		}
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
			},
			hmr: {
				protocol: 'wss',
				// Use the port from the ASTRO_PORT env var if available, otherwise default
				port: process.env.LISTEN_PORT ? 443 : 24678,
				clientPort: process.env.LISTEN_PORT ? 443 : 24678
			}
		}
	},
	server: {
		// Expose the server to the network
		host: true
	}
});
