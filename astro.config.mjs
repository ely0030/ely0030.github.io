// @ts-check
import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import rehypePrism from 'rehype-prism-plus';

// https://astro.build/config
export default defineConfig({
	site: 'https://ely0030.github.io',
	base: '/',
	integrations: [mdx(), sitemap()],
	output: 'static',
	markdown: {
		remarkPlugins: [remarkBreaks],
		syntaxHighlight: 'prism',
		rehypePlugins: [[rehypePrism, { ignoreMissing: true }]],
	},
});
