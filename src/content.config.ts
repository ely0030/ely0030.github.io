import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: z.object({
		title: z.string(),
		description: z.string(),
		// Transform string to Date object
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.string().optional(),
		// Password-protection fields
		private: z.boolean().optional(),
		passwordHash: z.string().optional(),
		// Optional mark fields for exclamation/question icons
		markType: z.enum(['exclamation', 'question']).optional(),
		markCount: z.number().int().min(1).max(3).optional(),
		markColor: z.enum(['grey', 'orange', 'blue']).optional(),
		// New optional page type for selecting alternate layouts
		pageType: z.enum(['blog', 'magazine', 'stanza', 'essay', 'literature', 'literature2', 'literature3', 'notepad', 'softonic', 'mediafire']).optional(),
		// Optional: strict spacing for literature (preserve exact line/space intent)
		strictSpacing: z.boolean().optional(),
		// Optional: immersive mode for literature (hide nav/sidebar chrome)
		immersive: z.boolean().optional(),
		// Determines which Astro layout component to use
		pageLayout: z.enum(['blog', 'book']).optional(),
		// Category for grouping posts
		category: z.string().optional(),
	}),
});

export const collections = { blog };
