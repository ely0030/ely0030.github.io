// @ts-check
import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import remarkPreserveNewlines from './src/utils/remark-preserve-newlines.js';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import rehypePrism from 'rehype-prism-plus';

// https://astro.build/config
const isProtectedProxy = !!process.env.LISTEN_PORT; // set by run-dev-protected / proxy flows

export default defineConfig({
	site: 'https://ely0030.xyz',
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
        // Use polling to reliably detect changes on WSL/Windows mounted drives
        // This avoids missed updates when editing under /mnt/c
        watch: {
            usePolling: true,
            interval: 300
        },
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:4322',
                changeOrigin: true
            }
        },
        // HMR: use plain WS in normal dev; WSS only when fronted by HTTPS proxy
        hmr: isProtectedProxy
            ? {
                protocol: 'wss',
                // Browser connects via the proxy's public port (LISTEN_PORT)
                clientPort: Number(process.env.LISTEN_PORT),
              }
            : {
                protocol: 'ws'
              }
    }
	},
	server: {
		// Expose the server to the network
		host: true
	}
});
